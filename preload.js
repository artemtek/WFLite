const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    executeCommand: (command) => ipcRenderer.invoke('execute-command', command)
}); 