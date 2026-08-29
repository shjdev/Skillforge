const { app, BrowserWindow, ipcMain, Notification, Tray, Menu } = require('electron');
const path = require('path');
const { resolveDueReminder, dateKey } = require('./scheduler');

const START_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
const LOAD_RETRY_MS = 1000;
const POLL_INTERVAL_MS = 20_000;
const ICON_PATH = path.join(__dirname, '..', 'src', 'app', 'favicon.ico');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Reminders already fired today, keyed by "YYYY-MM-DD-slot". Reset
// naturally as the date rolls over (old keys are just never checked again).
let firedKeysByDate = { date: dateKey(new Date()), keys: new Set() };

function firedKeysForToday() {
  const today = dateKey(new Date());
  if (firedKeysByDate.date !== today) {
    firedKeysByDate = { date: today, keys: new Set() };
  }
  return firedKeysByDate.keys;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'SkillForge',
    backgroundColor: '#0f172a',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Closing the window hides it instead of quitting so background reminder
  // polling keeps running — real desktop notifications need the app alive.
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
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

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(ICON_PATH);
  tray.setToolTip('SkillForge');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir SkillForge', click: showWindow },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', showWindow);
}

function showReminderNotification(title, body) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, icon: ICON_PATH });
  notification.on('click', showWindow);
  notification.show();
}

/**
 * Polls the app's own API for the user's reminder schedule and fires a
 * native OS notification when a session slot is due. Runs independently of
 * the renderer/window state so reminders keep firing while minimized to
 * the tray.
 */
async function pollReminders() {
  try {
    const res = await fetch(`${START_URL}/api/profile`);
    if (!res.ok) return;
    const profile = await res.json();
    if (!profile || profile.error) return;

    const due = resolveDueReminder(profile, new Date(), firedKeysForToday());
    if (due) {
      firedKeysForToday().add(due.key);
      showReminderNotification(due.title, due.body);
    }
  } catch {
    // Dev server not reachable yet (or momentarily down) — try again next tick.
  }
}

// Ensure only one instance of the app runs at a time.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    app.setAppUserModelId('com.skillforge.app');
    createWindow();
    createTray();
    pollReminders();
    setInterval(pollReminders, POLL_INTERVAL_MS);

    app.on('activate', showWindow);
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    // Windows/Linux: keep running in the tray instead of quitting so
    // reminders keep firing. macOS already keeps apps alive by convention.
  });

  ipcMain.handle('notification:send', (_event, data) => {
    const title = (data && data.title) || 'SkillForge';
    const body = (data && data.body) || '';

    if (!Notification.isSupported()) {
      return { success: false, reason: 'unsupported' };
    }

    showReminderNotification(title, body);
    return { success: true };
  });
}
