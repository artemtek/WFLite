import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPluginsHandler,
  executeWorkflowHandler,
  dialogSaveFileHandler,
  dialogLoadFileHandler,
  dialogOpenFolderHandler,
  getPluginsHandler,
  savePluginHandler,
  deletePluginHandler,
  validatePluginHandler,
  fetchPluginFromUrlHandler,
  bulkSavePluginsHandler,
  bulkFetchPluginsHandler,
} from './handlers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Function to create the browser window.
function createWindow() {
  // Prevent window from stealing focus on nodemon restarts
  mainWindow = new BrowserWindow({
    width: 2000,
    height: 1200,
    show: false,  // Don't show initially to prevent focus stealing
    webPreferences: {
      nodeIntegration: true,  // For accessing Node.js APIs in the renderer (be cautious with security)
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false
    }
  });

  // Load the frontend HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools
  // Note: Autofill protocol errors in DevTools console are harmless and expected in Electron.
  // They cannot be suppressed as they're logged directly by Electron's DevTools to stderr.
  mainWindow.webContents.openDevTools();

  // Show window without stealing focus when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive();  // Shows window without giving it focus
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Handle IPC requests
ipcMain.handle('execute-workflow', executeWorkflowHandler);
ipcMain.handle('load-plugins', loadPluginsHandler);
ipcMain.handle('dialog-open-file', dialogLoadFileHandler);
ipcMain.handle('dialog-save-file', dialogSaveFileHandler);
ipcMain.handle('dialog-open-folder', dialogOpenFolderHandler);
// Plugin management handlers
ipcMain.handle('get-plugins', getPluginsHandler);
ipcMain.handle('save-plugin', savePluginHandler);
ipcMain.handle('delete-plugin', deletePluginHandler);
ipcMain.handle('validate-plugin', validatePluginHandler);
ipcMain.handle('fetch-plugin-from-url', fetchPluginFromUrlHandler);
ipcMain.handle('bulk-save-plugins', bulkSavePluginsHandler);
ipcMain.handle('bulk-fetch-plugins', bulkFetchPluginsHandler);


// Called when Electron is ready
app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', function () {
  // On macOS, apps generally stay open until the user explicitly quits
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
