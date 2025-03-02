const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;

// Function to create the browser window.
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 2000,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,  // For accessing Node.js APIs in the renderer (be cautious with security)
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the frontend HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Handle command execution
ipcMain.handle('execute-command', async (event, command) => {
  if (!command) {
    throw new Error('Command is required');
  }

  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args);

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output || error,
        code
      });
    });

    process.on('error', (err) => {
      reject({
        success: false,
        error: err.message,
        code: 1
      });
    });
  });
});

// Handle load plugins from plugins folder
ipcMain.handle('load-plugins', async (event) => {
  const plugins = fs.readdirSync(path.join(__dirname, 'plugins'));
  const parsedPlugins = plugins.map(plugin => JSON.parse(fs.readFileSync(path.join(__dirname, 'plugins', plugin), 'utf8')));
  return parsedPlugins;
});

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
