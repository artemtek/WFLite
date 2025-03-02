const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
    loadPlugins: () => ipcRenderer.invoke('load-plugins'),
    dialogOpenFile: () => ipcRenderer.invoke('dialog-open-file'),
    dialogSaveFile: () => ipcRenderer.invoke('dialog-save-file'),
}); 