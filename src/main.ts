import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'net';

const isDev = !app.isPackaged && process.env.FORCE_PROD !== 'true';
let daemonProcess: ChildProcess | null = null;

// Register the app protocol early
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

async function isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

async function startDaemon() {
    const port = 3555;
    const open = await isPortOpen(port);
    if (!open) {
        console.log('Parallax server already running on port', port);
        return;
    }

    console.log('Starting Parallax daemon...');

    let daemonPath: string;
    let args: string[];

    if (isDev) {
        // In dev, we can point to the sibling repo or use tsx
        daemonPath = 'npx';
        args = ['-y', 'tsx', path.join(__dirname, '../../parallax-cli/src/server.ts')];
    } else {
        // In production, we'll use the compiled JS
        // We'll place it in the resources folder
        daemonPath = process.execPath; 
        const bundledServerPath = path.join(process.resourcesPath, 'daemon/dist/server.js');
        args = [bundledServerPath];
    }

    console.log(`Spawning daemon at ${daemonPath} with args ${args.join(' ')}`);

    daemonProcess = spawn(daemonPath, args, {
        shell: true,
        stdio: 'inherit',
        env: { 
            ...process.env, 
            PORT: port.toString(),
            ELECTRON_RUN_AS_NODE: isDev ? undefined : '1'
        }
    });

    daemonProcess.on('error', (err) => {
        console.error('Failed to start daemon:', err);
    });

    daemonProcess.on('exit', (code) => {
        console.log(`Daemon exited with code ${code}`);
    });
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false, // Frameless window
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, '../assets/icon.png')
    });

    if (isDev) {
        // In development mode, point to the Next.js dev server
        mainWindow.loadFile(path.join(__dirname, '../prenextview/index.html'));
        setTimeout(() => {
            mainWindow?.loadURL('http://localhost:3000');
        }, 2000); // wait 2 seconds for nextjs to boot
        // mainWindow.webContents.openDevTools();
    } else {
        // In production, load from the app protocol
        mainWindow.loadURL('app://localhost/index.html');
    }

    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window-maximized', true);
    });

    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window-maximized', false);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    // Start the daemon server
    await startDaemon();

    // Handle the app protocol for static files
    protocol.handle('app', (request) => {
        const url = new URL(request.url);
        let pathname = url.pathname;

        if (pathname === '/' || pathname === '') {
            pathname = '/index.html';
        }

        const baseDir = app.isPackaged
            ? path.join(__dirname, '../web-out')
            : path.join(__dirname, '../../web/out');

        const filePath = path.join(baseDir, pathname);

        return net.fetch(pathToFileURL(filePath).toString());
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (daemonProcess) daemonProcess.kill();
        app.quit();
    }
});

app.on('will-quit', () => {
    if (daemonProcess) daemonProcess.kill();
});

// Basic IPC for window controls (since it's frameless, we need minimize/maximize/close)
ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
});

ipcMain.on('window-toggle-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.on('window-close', () => {
    mainWindow?.close();
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});
