import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowToggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
        ipcRenderer.on('window-maximized', (_event, isMaximized) => callback(isMaximized));
    },
    selectDirectory: () => ipcRenderer.invoke('select-directory')
});
