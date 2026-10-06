// Starts the newest app code: an update unpacked under userData, or the copy that was installed.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { isNewer } = require('./version.js');

const installed = require('../package.json').version;
const updatesDir = path.join(app.getPath('userData'), 'updates');
const pointer = path.join(updatesDir, 'current.json');

process.env.QR_BASE_DIR = path.join(__dirname, '..');
process.env.QR_VERSION = installed;

let entry = './main.js';
try {
  const { version } = JSON.parse(fs.readFileSync(pointer, 'utf8'));
  const candidate = path.join(updatesDir, version, 'desktop', 'main.js');
  if (isNewer(version, installed) && fs.existsSync(candidate)) {
    entry = candidate;
    process.env.QR_VERSION = version;
  }
} catch {}

try {
  require(entry);
} catch (error) {
  if (entry === './main.js') throw error;
  // A broken update must not lock the user out: drop it and start the installed copy.
  fs.rmSync(pointer, { force: true });
  app.relaunch();
  app.exit(0);
}
