import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPluginsHandler,
  executeWorkflowHandler,
  dialogSaveFileHandler,
  dialogLoadFileHandler,
  dialogOpenFolderHandler,
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
