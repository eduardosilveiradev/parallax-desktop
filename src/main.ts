import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

const isDev = !app.isPackaged && process.env.FORCE_PROD !== 'true';
let daemonProcess: ChildProcess | null = null;

// Register the app protocol early
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);



async function startDaemon() {
    const port = 3555;
    console.log('Starting Parallax daemon...');

    let daemonPath: string;
    let args: string[];

    if (isDev) {
        // In dev, we can point to the sibling repo or use tsx
        daemonPath = 'npx';
        args = ['-y', 'tsx', path.join(app.getAppPath(), '../../parallax-cli/src/server.ts')];
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
            preload: path.join(app.getAppPath(), 'dist/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(app.getAppPath(), 'assets/icon.png')
    });

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

async function waitForDaemon(port: number) {
    const url = `http://localhost:${port}/ping`;
    while (true) {
        try {
            const resp = await net.fetch(url);
            if (resp.ok) return;
        } catch (e) {
            // Ignore errors while waiting
        }
        await new Promise(r => setTimeout(r, 200));
    }
}

app.whenReady().then(async () => {
    // 1. Create window and show "Starting Engine" screen
    createWindow();
    
    // In dev, __dirname is src/dist. In prod, it's dist/
    const prenextDir = path.join(__dirname, '..', 'prenextview');
    mainWindow?.loadFile(path.join(prenextDir, 'starting.html'));

    // 2. Start the daemon server
    void startDaemon();

    // 3. Wait for daemon to be ready (polled via /ping)
    await waitForDaemon(3555);
    await new Promise(r => setTimeout(r, 500)); // Small buffer for stability
    console.log('Daemon is ready, transitioning to Next.js splash...');

    // 4. Handle the app protocol for static files
    protocol.handle('app', (request) => {
        const url = new URL(request.url);
        let pathname = url.pathname;

        if (pathname === '/' || pathname === '') {
            pathname = '/index.html';
        }

        const baseDir = app.isPackaged
            ? path.join(app.getAppPath(), '../web-out')
            : path.join(app.getAppPath(), '../web/out');

        const filePath = path.join(baseDir, pathname);

        return net.fetch(pathToFileURL(filePath).toString());
    });

    // 5. Navigate to the main app or Next.js splash
    if (isDev) {
        mainWindow?.loadFile(path.join(prenextDir, 'index.html'));
        setTimeout(() => {
            console.log('Transitioning to main Next.js app...');
            mainWindow?.loadURL('http://localhost:3000');
        }, 3000); // Give Next.js more time to boot
    } else {
        mainWindow?.loadURL('app://localhost/index.html');
    }

    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }

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
