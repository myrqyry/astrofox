#!/usr/bin/env node
// Electron probe script - prints properties of require('electron') from the main process
const electron = require('electron');
console.log('electron type:', typeof electron);
try {
  console.log('Object.keys(electron):', Object.keys(electron));
} catch (e) {
  console.error('Error listing electron keys:', e && (e.stack || e.message || e));
}
const app = electron.app || (electron.remote && electron.remote.app);
console.log('app exists:', !!app);
if (app) {
  try {
    console.log('app.getName ->', typeof app.getName === 'function' ? app.getName() : app.getName);
    console.log('app.getVersion ->', typeof app.getVersion === 'function' ? app.getVersion() : app.getVersion);
    console.log('app.getPath(userData) ->', typeof app.getPath === 'function' ? app.getPath('userData') : 'no getPath');
  } catch (err) {
    console.error('app call failed:', err && (err.stack || err.message || err));
  }
}
console.log('process.versions:', process.versions);
console.log('process.execPath:', process.execPath);
console.log('process.argv:', process.argv);
// exit after printing
setTimeout(()=>process.exit(0), 50);