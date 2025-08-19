import fs from 'fs';
import path from 'path';
import glob from 'glob';
import debug from 'debug';
import { removeFile, createFolder } from 'utils/io';
import * as env from './environment';
import initMenu from './menu';
import initAutoUpdate from './autoupdate';
import initEvents from './events';

// Guarded runtime require for electron so this module doesn't crash when required under plain Node
let app;
let session;
let systemPreferences;
try {
  // eslint-disable-next-line global-require
  const electron = require('electron');
  app = electron && (electron.app || (electron.remote && electron.remote.app));
  session = electron && (electron.session || (electron.remote && electron.remote.session));
  systemPreferences = electron && (electron.systemPreferences || (electron.remote && electron.remote.systemPreferences));
} catch (e) {
  app = null;
  session = null;
  systemPreferences = null;
}

const log = debug('init');

async function removeTempFiles() {
  const files = glob.sync('*.*', { cwd: env.TEMP_PATH });
  const promises = [];

  files.forEach(file => promises.push(removeFile(path.join(env.TEMP_PATH, file))));

  return Promise.all(promises);
}

function loadExtensions(session) {
  // Allow explicit control via ASTROFOX_LOAD_EXTENSIONS:
  // - If set to "true" -> attempt loading
  // - If set to "false" -> skip loading
  // - If not set -> fall back to NODE_ENV !== 'production' (original behavior)
  const envFlag = process.env.ASTROFOX_LOAD_EXTENSIONS;
  const shouldLoad = envFlag !== undefined ? envFlag === 'true' : process.env.NODE_ENV !== 'production';

  if (!shouldLoad) {
    log('Chrome extension auto-loading disabled via ASTROFOX_LOAD_EXTENSIONS=%s', String(envFlag));
    return Promise.resolve([]);
  }

  if (!session || typeof session.loadExtension !== 'function') {
    log('session.loadExtension is not available on this Electron build; skipping extension load');
    return Promise.resolve([]);
  }

  const dirs = {
    win32: '/AppData/Local/Google/Chrome/User Data/Default/Extensions',
    darwin: '/Library/Application Support/Google/Chrome/Default/Extensions',
    linux: '/.config/google-chrome/Default/Extensions',
  };

  const extensions = ['fmkadmapgofadopljbjfkapdkoienihi', 'lmhkpmbekcpmknklioeibfkpmmfibljd'];
  const promises = [];

  for (const ext of extensions) {
    try {
      const baseDir = dirs[process.platform] || '';
      const fullPath = path.join(app.getPath('home'), baseDir, ext);

      if (!fs.existsSync(fullPath)) {
        log('Extension folder not found for %s at %s', ext, fullPath);
        continue;
      }

      const dir = fs
        .readdirSync(fullPath)
        .filter(file => {
          try {
            return fs.statSync(path.join(fullPath, file)).isDirectory();
          } catch (err) {
            // If stat fails for an entry, skip it but continue processing others
            log('Failed to stat file while scanning extension dir for %s: %s', ext, err && err.message);
            return false;
          }
        });

      if (!dir.length) {
        log('No version directory found for extension %s in %s', ext, fullPath);
        continue;
      }

      const extPath = path.join(fullPath, dir[0]);
      log('Attempting to add extension %s from %s', ext, extPath);

      // Wrap each loadExtension call so a single failing extension doesn't reject all.
      const p = Promise.resolve()
        .then(() => session.loadExtension(extPath))
        .catch(err => {
          // Log detailed error for troubleshooting, but swallow the error so startup continues.
          try {
            log('Failed to load extension %s: %o', ext, err && (err.stack || err.message || err));
          } catch (logErr) {
            // Ensure logging itself never throws
            // eslint-disable-next-line no-console
            console.error('Failed to log extension load error', logErr);
          }
          return null;
        });

      promises.push(p);
    } catch (err) {
      // Catch any unexpected errors during discovery and continue.
      log('Unexpected error while preparing extension %s: %o', ext, err && (err.stack || err.message || err));
    }
  }

  // Promise.all resolves once all attempts settle; filter out failed (null) results.
  return Promise.all(promises).then(results => results.filter(Boolean));
}

export default async function init() {
  log('Initialize application');

  await createFolder(env.TEMP_PATH);
  await removeTempFiles();

  // Decide whether to load extensions: respect ASTROFOX_LOAD_EXTENSIONS if set,
  // otherwise keep previous behavior (only load when NODE_ENV !== 'production').
  const envFlag = process.env.ASTROFOX_LOAD_EXTENSIONS;
  const shouldLoadExtensions = envFlag !== undefined ? envFlag === 'true' : process.env.NODE_ENV !== 'production';

  if (shouldLoadExtensions) {
    try {
      // Use defaultSession as before, but guard against thrown errors so startup isn't blocked
      await loadExtensions(session.defaultSession);
    } catch (err) {
      log('Error while loading extensions (this will not stop startup): %o', err && (err.stack || err.message || err));
    }
  } else {
    log('Skipping extension loading (ASTROFOX_LOAD_EXTENSIONS=%s, NODE_ENV=%s)', String(envFlag), process.env.NODE_ENV);
  }

  initMenu();
  initEvents();
  initAutoUpdate();

  // Modify the user agent for all requests to the following urls
  const filter = {
    urls: ['https://*.astrofox.io/*'],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    details.requestHeaders['User-Agent'] = env.USER_AGENT;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  // Disable menu items on macOS
  if (process.platform === 'darwin') {
    systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
    systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
  }
}
