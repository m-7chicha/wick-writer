const { app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let mainWindow = null;
let httpServer = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function bootLocalServer() {
  const userDataDir = app.getPath('userData');
  process.env.NODE_ENV = 'production';
  process.env.WICK_NO_AUTO_START = '1';
  process.env.WICK_DATA_DIR = userDataDir;

  const rootDir = path.join(__dirname, '..');
  const bundledServer = path.join(rootDir, 'dist-server', 'server.mjs');
  const tsServer = path.join(rootDir, 'server.ts');
  const entryPath = fs.existsSync(bundledServer) ? bundledServer : tsServer;

  const serverMod = await import(pathToFileURL(entryPath).href);
  const { server, port } = await serverMod.startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir: userDataDir,
    isProd: true,
  });
  httpServer = server;
  return `http://127.0.0.1:${port}`;
}

function createWindow(appUrl) {
  const iconFile =
    process.platform === 'win32'
      ? path.join('assets', 'wick-icon.ico')
      : path.join('public', 'pwa-512x512.png');
  const iconPath = path.join(__dirname, '..', iconFile);

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'WICK',
    backgroundColor: '#0b0b0e',
    autoHideMenuBar: true,
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  void mainWindow.loadURL(appUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!gotLock) return;
  try {
    const appUrl = await bootLocalServer();
    createWindow(appUrl);
  } catch (err) {
    console.error('Failed to start WICK desktop backend:', err);
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && httpServer) {
    const addr = httpServer.address();
    if (addr && typeof addr === 'object') {
      createWindow(`http://127.0.0.1:${addr.port}`);
    }
  }
});

app.on('before-quit', () => {
  if (httpServer) {
    try {
      httpServer.close();
    } catch {
      // ignore close errors during shutdown
    }
    httpServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
