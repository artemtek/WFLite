import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    executeWorkflow: (workflow) => ipcRenderer.invoke('execute-workflow', workflow),
    loadPlugins: () => ipcRenderer.invoke('load-plugins'),
    dialogOpenFile: () => ipcRenderer.invoke('dialog-open-file'),
    dialogSaveFile: (data) => ipcRenderer.invoke('dialog-save-file', data),
    dialogOpenFolder: () => ipcRenderer.invoke('dialog-open-folder'),
}); 