import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPluginsHandler,
  executeWorkflowHandler,
  dialogSaveFileHandler,
  dialogLoadFileHandler,
} from './handlers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Function to create the browser window.
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 2000,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,  // For accessing Node.js APIs in the renderer (be cautious with security)
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false
    }
  });

  // Load the frontend HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Handle IPC requests
ipcMain.handle('execute-workflow', executeWorkflowHandler);
ipcMain.handle('load-plugins', loadPluginsHandler);
ipcMain.handle('dialog-open-file', dialogLoadFileHandler);
ipcMain.handle('dialog-save-file', dialogSaveFileHandler);


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
