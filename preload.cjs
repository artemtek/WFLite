const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    executeWorkflow: (workflow) => ipcRenderer.invoke('execute-workflow', workflow),
    killWorkflowProcesses: () => ipcRenderer.invoke('kill-workflow-processes'),
    loadPlugins: () => ipcRenderer.invoke('load-plugins'),
    dialogOpenFile: () => ipcRenderer.invoke('dialog-open-file'),
    dialogSaveFile: (data) => ipcRenderer.invoke('dialog-save-file', data),
    dialogOpenFolder: () => ipcRenderer.invoke('dialog-open-folder'),
    // Plugin management
    getPlugins: () => ipcRenderer.invoke('get-plugins'),
    savePlugin: (pluginData, filename) => ipcRenderer.invoke('save-plugin', pluginData, filename),
    deletePlugin: (filename) => ipcRenderer.invoke('delete-plugin', filename),
    validatePlugin: (pluginData) => ipcRenderer.invoke('validate-plugin', pluginData),
    fetchPluginFromUrl: (url) => ipcRenderer.invoke('fetch-plugin-from-url', url),
    bulkSavePlugins: (plugins) => ipcRenderer.invoke('bulk-save-plugins', plugins),
    bulkFetchPlugins: (urls) => ipcRenderer.invoke('bulk-fetch-plugins', urls),
}); 