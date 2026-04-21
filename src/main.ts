import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged && process.env.FORCE_PROD !== 'true';

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
    });

    if (isDev) {
        // In development mode, point to the Next.js dev server
        mainWindow.loadFile(path.join(__dirname, '../prenextview/index.html'));
        setTimeout(() => {
            mainWindow?.loadURL('http://localhost:3000');
        }, 2000); // wait 2 seconds for nextjs to boot
        // mainWindow.webContents.openDevTools();
    } else {
        // In production, point to the static export
        mainWindow.loadFile(path.join(__dirname, '../../web/out/index.html'));
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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
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
