const { app, BrowserWindow, dialog } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');

let mainWindow;
let splashWindow;
let frontendProcess;

function killPorts(callback) {
	const command = process.platform === 'win32'
		? `for /f "tokens=5" %a in ('netstat -aon ^| find ":4200" ^| find "LISTENING"') do taskkill /F /PID %a`
		: `lsof -ti:4200 | xargs kill -9`;

	exec(command, (err, stdout, stderr) => {
		if (err) {
			console.warn('⚠️ Port 4200 not in use or failed to kill:', stderr.trim());
		} else {
			console.log('✅ Killed process on port 4200:', stdout.trim());
		}
		callback();
	});
}

function startFrontend(callback) {
	const angularDistPath = path.join(process.resourcesPath, 'app');
	const serveCommand = 'npx';
	const serveArgs = ['serve', '-s', `"${angularDistPath}"`, '--single', '-l', '4200'];
	console.log(`"${angularDistPath}"`);
	console.log('🟡 Starting Angular frontend...');

	frontendProcess = spawn(serveCommand, serveArgs, { shell: true });

	frontendProcess.stdout.on('data', data => {
		console.log(`Frontend: ${data}`);
		if (data.toString().includes('Accepting connections')) {
			console.log('✅ Frontend is running.');
			callback(); // call callback as soon as the server is ready
		}
	});

	frontendProcess.stderr.on('data', data => {
		console.error(`Frontend error: ${data}`);
	});

	frontendProcess.on('error', err => {
		console.error('❌ Failed to spawn frontend:', err);
		dialog.showErrorBox('Frontend Error', err.message || 'Failed to start frontend');
	});
}


function createMainWindow() {
	console.log('🟢 Creating main window...');
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		show: false,
		icon: path.join(__dirname, 'brain.ico'),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
		autoHideMenuBar: true,
	});


	mainWindow.loadURL('http://localhost:4200');
	
	mainWindow.webContents.on('did-finish-load', () => {
		if (splashWindow) splashWindow.close();
		mainWindow.show();
		mainWindow.maximize();
		console.log('✅ Main window finished loading.');
	});

	mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
		console.error(`❌ Window failed to load: ${code} - ${desc}`);
		dialog.showErrorBox('Window Load Failed', desc);
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
		stopProcesses();
	});
}

function showSplashScreen() {
	splashWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		frame: false,
		transparent: false,
		resizable: false,
		center: true,
	});

	splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function stopProcesses() {
	exec('taskkill /F /IM server.exe', () => console.log('🛑 Backend stopped.'));
	if (frontendProcess) {
		frontendProcess.kill();
		console.log('🛑 Frontend process killed.');
	}
}

app.whenReady().then(() => {
	// exec('taskkill /F /IM server.exe');
	showSplashScreen();
	exec(`"${path.join(process.resourcesPath, 'server.exe')}"`, () => console.log('🛑 Backend start.'));
	killPorts(() => {
		startFrontend(() => {
			createMainWindow();
		});
	});
});


app.on('window-all-closed', () => {
	stopProcesses();
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
