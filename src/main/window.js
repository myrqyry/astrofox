import { BrowserWindow, BrowserView } from 'electron';
import path from 'path';
import url from 'url';
import debug from 'debug';
import {
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_MINWIDTH,
  WINDOW_MINHEIGHT,
  WINDOW_BGCOLOR,
} from './constants';

const PORT = process.env.PORT || 3000;
const log = debug('window');

// Respect GPU-related environment variables so users can disable GPU/WebGL when needed.
//
// Environment variables:
// - ASTROFOX_DISABLE_GPU=true or ASTROFOX_DISABLE_WEBGL=true -> disable WebGL in renderer
// - ASTROFOX_SOFTWARE_GL=true or LIBGL_ALWAYS_SOFTWARE=1 -> force Mesa software rendering (Linux)
// - ASTROFOX_USE_SWIFT_SHADER=true -> request SwiftShader usage (handled in main/index.js)
const ASTROFOX_DISABLE_GPU = process.env.ASTROFOX_DISABLE_GPU === 'true' || process.env.ASTROFOX_DISABLE_WEBGL === 'true';
const ASTROFOX_SOFTWARE_GL = process.env.ASTROFOX_SOFTWARE_GL === 'true' || process.env.LIBGL_ALWAYS_SOFTWARE === '1';

let win = null;

export function getWindow() {
  return win;
}

export function showWindow() {
  win.show();

  if (process.env.NODE_ENV !== 'production') {
    win.webContents.openDevTools();
  }
}

export function disposeWindow() {
  win = null;
}

export function sendMessage(channel, data) {
  win.webContents.send(channel, data);
}

export function getWindowState() {
  return {
    focused: win.isFocused(),
    maximized: win.isMaximized(),
    minimized: win.isMinimized(),
  };
}

export function updateWindowState() {
  sendMessage('window-state-changed', getWindowState());
}

export function createWindow() {
  if (win !== null) return;

  // Create window
  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MINWIDTH,
    minHeight: WINDOW_MINHEIGHT,
    backgroundColor: WINDOW_BGCOLOR,
    show: false,
    frame: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      backgroundThrottling: false,
      textAreasAreResizable: false,
      devTools: true,
      // If GPU or WebGL is explicitly disabled via env, turn WebGL off for renderer processes.
      // This avoids attempts to create WebGL contexts on systems with broken drivers.
      webgl: !ASTROFOX_DISABLE_GPU,
    },
  });

  // Log GPU/WebGL configuration for diagnostics
  try {
    // app.getGPUFeatureStatus() is available in Electron; require lazily to avoid test issues
    // eslint-disable-next-line global-require
    const { app: electronApp } = require('electron');
    const gpuStatus = typeof electronApp.getGPUFeatureStatus === 'function' ? electronApp.getGPUFeatureStatus() : null;
    log('createWindow - ASTROFOX_DISABLE_GPU=%s, ASTROFOX_SOFTWARE_GL=%s, GPU feature status=%o', String(ASTROFOX_DISABLE_GPU), String(ASTROFOX_SOFTWARE_GL), gpuStatus);
  } catch (e) {
    log('createWindow - failed to query GPU feature status: %O', e && (e.stack || e.message || e));
  }

  if (process.env.NODE_ENV === 'production') {
    const view = new BrowserView();
    win.setBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    view.webContents.loadURL('https://astrofox.io/hello');
  }

  // Load index page
  win.loadURL(
    process.env.NODE_ENV === 'production'
      ? url.format({
          pathname: path.join(__dirname, 'index.html'),
          protocol: 'file',
          slashes: true,
        })
      : `http://localhost:${PORT}`,
  );

  // Show window only when ready
  win.on('ready-to-show', () => {
    log('ready-to-show');
    showWindow();
  });

  // Window close
  win.on('close', () => {
    log('close');
  });

  win.on('closed', () => {
    log('closed');
  });

  // State events
  win.on('minimize', updateWindowState);
  win.on('maximize', updateWindowState);
  win.on('unmaximize', updateWindowState);
  win.on('focus', updateWindowState);
  win.on('blur', updateWindowState);
}
