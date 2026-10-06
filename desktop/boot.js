// Starts the newest app code: an update unpacked under userData, or the copy that was installed.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { isNewer } = require('./version.js');

// The data folder keeps one name whatever the app is called, so a rename never loses data.
// QUICKWAI_DATA_DIR lets a development copy run next to the installed app.
const userData = process.env.QUICKWAI_DATA_DIR || path.join(app.getPath('appData'), 'QuickWai');
const legacyData = path.join(app.getPath('appData'), 'quickreply');
if (!fs.existsSync(path.join(userData, 'quickreply.json')) && fs.existsSync(path.join(legacyData, 'quickreply.json'))) {
  fs.mkdirSync(userData, { recursive: true });
  for (const item of ['quickreply.json', 'license.json', 'images']) {
    const from = path.join(legacyData, item);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(userData, item), { recursive: true });
  }
}
app.setName('QuickWai');
app.setPath('userData', userData);
app.setAppUserModelId('com.quickwai.app');

const installed = require('../package.json').version;
const updatesDir = path.join(userData, 'updates');
const pointer = path.join(updatesDir, 'current.json');

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
