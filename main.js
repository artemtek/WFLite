const { app, BrowserWindow } = require('electron');
const path = require('path');
const spawn = require('child_process').spawn;

let mainWindow;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true,
		},
	});

	mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.whenReady().then(() => {
	createWindow();
});

function startServer() {
	// spawn the server process in a new child process
	const serverProcess = spawn('node', [path.join(__dirname, 'server.js')]);

	serverProcess.stdout.on('data', (data) => {
		console.log(data.toString());
	});

	serverProcess.stderr.on('data', (data) => {
		console.error(data.toString());
	});
}


app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});


app.on('activate', () => {
	if (mainWindow === null) {
		createWindow();
	}
});
