const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const isDev = process.env.NODE_ENV === 'development';
const GEMINI_API_KEY = process.env.VITE_GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

const settingsPath = path.join(app.getPath('userData'), 'window-settings.json');

function loadWindowSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load window settings:', e);
  }
  return { width: 600, height: 800, x: undefined, y: undefined };
}

function saveWindowSettings(win) {
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(settingsPath, JSON.stringify(bounds));
  } catch (e) {
    console.error('Failed to save window settings:', e);
  }
}

let mainWindow = null;
let tray = null;

const createWindow = () => {
  const savedBounds = loadWindowSettings();
  
  mainWindow = new BrowserWindow({
    ...savedBounds,
    width: savedBounds.width || 600,
    height: savedBounds.height || 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#f8fafc'
    },
    backgroundColor: '#0f172a',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    const settings = loadSettings();
    if (settings.minimizeToTray && settings.trayAction === 'minimize') {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('resize', () => saveWindowSettings(mainWindow));
  mainWindow.on('move', () => saveWindowSettings(mainWindow));
};

function loadSettings() {
  try {
    const settingsFile = path.join(app.getPath('userData'), 'app-settings.json');
    if (fs.existsSync(settingsFile)) {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load app settings:', e);
  }
  return {
    desktopHotkey: 'Control + Shift + D',
    micHotkey: 'Control + Shift + M',
    minimizeToTray: true,
    trayAction: 'minimize',
    enableDiscordActivity: false,
    rememberWindowLocation: true,
    rememberWindowSize: true,
  };
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let icon;
  
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      mainWindow?.destroy();
      app.quit();
    }}
  ]);
  
  tray.setToolTip('MRA Anime');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

function registerHotkeys(settings) {
  globalShortcut.unregisterAll();

  if (settings.desktopHotkey) {
    try {
      globalShortcut.register(settings.desktopHotkey, () => {
        mainWindow?.webContents.send('trigger-listen', 'desktop');
      });
    } catch (e) {
      console.error('Failed to register desktop hotkey:', e);
    }
  }

  if (settings.micHotkey) {
    try {
      globalShortcut.register(settings.micHotkey, () => {
        mainWindow?.webContents.send('trigger-listen', 'mic');
      });
    } catch (e) {
      console.error('Failed to register mic hotkey:', e);
    }
  }
}

function saveAppSettings(settings) {
  try {
    const settingsFile = path.join(app.getPath('userData'), 'app-settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save app settings:', e);
  }
}

app.whenReady().then(() => {
  const settings = loadSettings();
  if (settings.minimizeToTray) {
    createTray();
  }
  registerHotkeys(settings);
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle('get-desktop-audio', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    const screenSource = sources.find(s => s.id.startsWith('screen')) || sources[0];
    return screenSource ? screenSource.id : null;
  } catch (err) {
    console.error("Desktop capture error:", err);
    return null;
  }
});

ipcMain.handle('get-settings', () => {
  return loadSettings();
});

ipcMain.on('save-settings', (event, settings) => {
  saveAppSettings(settings);
  
  if (settings.minimizeToTray && !tray) {
    createTray();
  } else if (!settings.minimizeToTray && tray) {
    tray.destroy();
    tray = null;
  }
  
  registerHotkeys(settings);
});

ipcMain.on('trigger-listen', (event, mode) => {
  mainWindow?.webContents.send('trigger-listen', mode);
});

// Gemini AI API handler (runs in main process to keep API key secure)
ipcMain.handle('gemini-ask', async (event, { title, artist }) => {
  if (!GEMINI_API_KEY) {
    return { error: 'API key not configured' };
  }
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `"${title}" by "${artist}" is an anime opening (OP) or ending (ED) theme. Which anime uses this song? Answer format: "AnimeName (OP)" or just "AnimeName"`;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Parse response
    const match = text.match(/(.+?)\s*\(?(OP|ED)\)?/i);
    if (match && match[1]) {
      return {
        title: match[1].trim(),
        type: match[2] ? match[2].toUpperCase() : 'Theme',
        url: '',
        imageUrl: ''
      };
    }
    return { error: 'Could not parse response' };
  } catch (err) {
    console.error('[MRA] Gemini error:', err.message);
    return { error: err.message };
  }
});