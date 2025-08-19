import path from 'path';
import os from 'os';

// Try to require Electron's `app` at runtime — this may not be available
// when running under plain Node or if resolution points to the npm electron shim.
// We guard all uses of `app` and provide sensible fallbacks so startup doesn't crash.
let app;
try {
  // eslint-disable-next-line global-require
  const electron = require('electron');
  app = electron && (electron.app || (electron.remote && electron.remote.app));
} catch (e) {
  app = null;
}

// If `app.getVersion` exists use it; otherwise fallback to package env or placeholder.
const version =
  app && typeof app.getVersion === 'function'
    ? app.getVersion()
    : process.env.npm_package_version || '0.0.0';

// Fallback app path / user data path when app is not available
const APP_PATH_FALLBACK = process.cwd();
const USER_DATA_FALLBACK = path.join(os.homedir() || APP_PATH_FALLBACK, '.astrofox');
const TEMP_FALLBACK = os.tmpdir ? path.join(os.tmpdir(), 'Astrofox') : path.join(APP_PATH_FALLBACK, 'tmp');

export const APP_NAME = 'Astrofox';
export const APP_VERSION = version;
export const APP_PATH = app && typeof app.getAppPath === 'function' ? app.getAppPath() : APP_PATH_FALLBACK;
export const OS_PLATFORM = os.platform();
export const IS_WINDOWS = OS_PLATFORM === 'win32';
export const IS_MACOS = OS_PLATFORM === 'darwin';
export const USER_DATA_PATH = app && typeof app.getPath === 'function' ? app.getPath('userData') : USER_DATA_FALLBACK;
export const PLUGIN_PATH = path.join(APP_PATH, '..', 'plugins');
export const TEMP_PATH = app && typeof app.getPath === 'function' ? path.join(app.getPath('temp'), APP_NAME) : TEMP_FALLBACK;
export const FFMPEG_BINARY = path.join(APP_PATH, '..', 'bin', IS_WINDOWS ? 'ffmpeg.exe' : 'ffmpeg');

export const APP_CONFIG_FILE = path.join(
  USER_DATA_PATH,
  process.env.NODE_ENV === 'production' ? 'app.config' : 'app.dev.config',
);
export const LICENSE_FILE = path.join(USER_DATA_PATH, 'license.dat');
export const ELECTRON_VERSION = process.versions && process.versions.electron ? process.versions.electron : '';
export const CHROME_VERSION = process.versions && process.versions.chrome ? process.versions.chrome : '';
export const V8_VERSION = process.versions && process.versions.v8 ? process.versions.v8 : '';
export const NODE_VERSION = process.versions && process.versions.node ? process.versions.node : '';
export const USER_AGENT = [
  `${APP_NAME}/${APP_VERSION} (${OS_PLATFORM})`,
  `Chrome/${CHROME_VERSION}`,
  `Electron/${ELECTRON_VERSION}`,
].join(' ');
