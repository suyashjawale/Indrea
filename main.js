const { app, BrowserWindow } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const url = require('url');
const fs = require('fs');  

let mainWindow;

function startPythonServer() {
	const prodServerPath = path.join(process.resourcesPath, 'server.exe');
	const devServerPath = path.join(__dirname, 'exeBuild', 'server.exe');

	const serverPath = fs.existsSync(prodServerPath) ? prodServerPath : devServerPath;
	exec(`"${serverPath}"`);
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			webSecurity: false, // 🔥 disables CORS and CSP blocks (dev-only!)
			allowRunningInsecureContent: true, // allow http calls from file://
		},
	});

	mainWindow.loadURL(
		url.format({
			pathname: path.join(__dirname, 'dist/eeg-poc/browser/index.html'),
			protocol: 'file:',
			slashes: true,
		})
	);

	mainWindow.on('closed', () => {
		mainWindow = null;
		stopBackend();
	});
}


function stopBackend() {
	exec('taskkill /F /IM server.exe');
}

app.whenReady().then(() => {
	startPythonServer();  // Start FastAPI backend
	createWindow();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		stopBackend();
		app.quit();
	}
});
