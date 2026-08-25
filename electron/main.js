const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');

const START_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
const LOAD_RETRY_MS = 1000;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'SkillForge',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  loadWithRetry();
}

function loadWithRetry() {
  if (!mainWindow) return;
  mainWindow.loadURL(START_URL).catch(() => {
    // The Next.js dev server may not be up yet (e.g. `npm run electron` was
    // started before `npm run dev`) — keep retrying instead of failing hard.
    setTimeout(loadWithRetry, LOAD_RETRY_MS);
  });
}

// Ensure only one instance of the app runs at a time.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  ipcMain.handle('notification:send', (_event, data) => {
    const title = (data && data.title) || 'SkillForge';
    const body = (data && data.body) || '';

    if (!Notification.isSupported()) {
      return { success: false, reason: 'unsupported' };
    }

    new Notification({ title, body }).show();
    return { success: true };
  });
}
