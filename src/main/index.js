import debug from 'debug';
import * as env from './environment';
import init from './init';
import { createWindow, disposeWindow } from './window';

const log = debug('main');

// Lazy runtime require for electron to avoid bundling electron into the compiled output.
// Guarded access prevents startup from crashing if `require('electron')` doesn't expose `app`.
let app;
let BrowserWindow;
try {
  // We intentionally use runtime require here so webpack emits a runtime `require('electron')`
  // expression (and externals like `electron: "require('electron')"` work as intended).
  const electron = require('electron');
  app = electron && (electron.app || (electron.remote && electron.remote.app));
  BrowserWindow = electron && (electron.BrowserWindow || (electron.remote && electron.remote.BrowserWindow));
} catch (e) {
  // Best-effort: leave app/BrowserWindow as null so code can guard against them.
  app = null;
  BrowserWindow = null;
}

// Show environment
log('NODE_ENV', process.env.NODE_ENV);

// Set global variables
global.env = env;
global.plugins = {};

// GPU / Chrome flags
// Environment switches (users can set these to influence startup behavior):
// - ASTROFOX_DISABLE_GPU=true -> disable hardware acceleration (recommended for broken GPU drivers)
// - ASTROFOX_SOFTWARE_GL=true -> set LIBGL_ALWAYS_SOFTWARE=1 (force Mesa software rendering on Linux)
// - ASTROFOX_USE_SWIFT_SHADER=true -> attempt to use SwiftShader (--use-gl=swiftshader) if available
// - ASTROFOX_IGNORE_GPU_BLACKLIST=false -> do NOT append --ignore-gpu-blacklist (default is to append)
//
// NOTE: app.disableHardwareAcceleration() must be called before 'ready' to take effect.
const ASTROFOX_DISABLE_GPU = process.env.ASTROFOX_DISABLE_GPU === 'true';
const ASTROFOX_SOFTWARE_GL = process.env.ASTROFOX_SOFTWARE_GL === 'true' || process.env.LIBGL_ALWAYS_SOFTWARE === '1';
const ASTROFOX_USE_SWIFT_SHADER = process.env.ASTROFOX_USE_SWIFT_SHADER === 'true';
const ASTROFOX_IGNORE_GPU_BLACKLIST = process.env.ASTROFOX_IGNORE_GPU_BLACKLIST !== 'false';

// If requested, force Mesa into software GL mode (Linux). This must be set early so the native loader
// picks it up. We still log it so users can diagnose issues.
if (ASTROFOX_SOFTWARE_GL) {
  process.env.LIBGL_ALWAYS_SOFTWARE = '1';
  log('Forcing Mesa software GL via LIBGL_ALWAYS_SOFTWARE=1');
}

// Guard all electron.app usage behind a runtime check so startup won't crash if `app` is missing.
if (app) {
  // If user explicitly asks to disable GPU, do it now (before app ready)
  if (ASTROFOX_DISABLE_GPU) {
    log('Disabling hardware acceleration via ASTROFOX_DISABLE_GPU=true');
    // This ensures Electron/Chromium will not use the GPU.
    try {
      app.disableHardwareAcceleration();
    } catch (err) {
      log('Failed to call app.disableHardwareAcceleration(): %O', err && (err.stack || err.message || err));
    }
  } else {
    // Default: try to enable GPU features while allowing opt-out
    if (ASTROFOX_IGNORE_GPU_BLACKLIST) {
      // Existing behavior: ignore GPU blacklist (helps on some systems but may crash on buggy drivers)
      try {
        app.commandLine.appendSwitch('ignore-gpu-blacklist');
        log('Appended Chrome switch: ignore-gpu-blacklist');
      } catch (err) {
        log('Failed to append ignore-gpu-blacklist switch: %O', err && (err.stack || err.message || err));
      }
    } else {
      log('Skipping ignore-gpu-blacklist due to ASTROFOX_IGNORE_GPU_BLACKLIST=%s', String(process.env.ASTROFOX_IGNORE_GPU_BLACKLIST));
    }

    if (ASTROFOX_USE_SWIFT_SHADER) {
      try {
        // Try to use SwiftShader (software GL) -- note: SwiftShader libraries must be present on the system
        app.commandLine.appendSwitch('use-gl', 'swiftshader');
        app.commandLine.appendSwitch('enable-features', 'SwiftShader');
        log('Configured SwiftShader (--use-gl=swiftshader)');
      } catch (err) {
        log('Failed to configure SwiftShader switches: %O', err && (err.stack || err.message || err));
      }
    }
  }

  // Memory profiling
  if (process.env.NODE_ENV !== 'production') {
    try {
      app.commandLine.appendSwitch('enable-precise-memory-info');
    } catch (err) {
      log('Failed to append enable-precise-memory-info: %O', err && (err.stack || err.message || err));
    }

    // Avoid "Skip checkForUpdatesAndNotify because application is not packed" error
    try {
      Object.defineProperty(app, 'isPackaged', {
        get() {
          return true;
        },
      });
    } catch (err) {
      log('Failed to set isPackaged property on app: %O', err && (err.stack || err.message || err));
    }
  }

  // Electron bug: https://github.com/electron/electron/issues/22119
  try {
    app.allowRendererProcessReuse = false;
  } catch (err) {
    log('Failed to set allowRendererProcessReuse: %O', err && (err.stack || err.message || err));
  }

  // Listen for GPU process crashes and log actionable guidance.
  // We can't reliably toggle hardware acceleration at runtime for the current process
  // (disableHardwareAcceleration must be called before 'ready'), so we provide clear logs
  // and guidance to relaunch with ASTROFOX_DISABLE_GPU=true when a GPU crash happens.
  try {
    app.on('gpu-process-crashed', (event, killed) => {
      log('gpu-process-crashed killed=%s', String(killed));
      try {
        // eslint-disable-next-line no-console
        console.error(
          'GPU process crashed. If you see MESA-LOADER or WebGL errors, try launching again with:\n' +
            '  ASTROFOX_DISABLE_GPU=true  (disable hardware acceleration)\n' +
            '  or ASTROFOX_SOFTWARE_GL=true  (force Mesa software rendering on Linux)\n' +
            'Example: ASTROFOX_DISABLE_GPU=true ./astrofox\n',
        );
      } catch (e) {
        // Best-effort logging only
        log('Error while logging gpu-process crash guidance: %O', e && (e.stack || e.message || e));
      }
    });
  } catch (err) {
    log('Failed to register gpu-process-crashed handler: %O', err && (err.stack || err.message || err));
  }

  // Also log when renderers go away (helpful for diagnosing driver/renderer problems)
  try {
    app.on('render-process-gone', (event, webContents, details) => {
      // This event may not be present in older Electron versions; guard defensively.
      try {
        log('render-process-gone', details && (details.reason || details));
      } catch (e) {
        log('render-process-gone handler error: %O', e && (e.stack || e.message || e));
      }
    });
  } catch (err) {
    log('Failed to register render-process-gone handler: %O', err && (err.stack || err.message || err));
  }

  // Application events
  app.on('ready', async () => {
    log('ready');

    await init();

    createWindow();
  });

  app.on('activate', () => {
    log('activate');

    if (BrowserWindow && BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on('window-all-closed', () => {
    log('window-all-closed');

    disposeWindow();

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    log('will-quit');
  });
} else {
  // Non-fatal: in environments where `app` isn't available, avoid crashing and log diagnostic guidance.
  log('Electron `app` is not available; skipping Electron-specific startup steps. If you are running under Electron, this indicates require("electron") returned an unexpected value.');
}
