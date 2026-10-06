const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, clipboard, nativeImage, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const readline = require('readline');
const { spawn, execFileSync } = require('child_process');
const license = require('./license.js');
const { checkForUpdate } = require('./updater.js');
const { needsName, fillName } = require('./ui/shared.js');

const PORT = 38457;
const PANEL_HOTKEY = 'Control+Space';
const EXTENSION_SOURCE = path.join(__dirname, '..', 'extension');
const ASSETS = path.join(__dirname, 'assets');
const ICON = path.join(ASSETS, 'icon.png');
const VERSION = process.env.QR_VERSION || '0.0.0';
const UPDATE_CHECK_MS = 24 * 3600000;
const STALE_MS = 4000;
const PASTE_GAP_MS = 450;
const WINDOW_TITLE = 'QuickWai - Florentino356';
const EXPIRY_WARN_DAYS = 7;
// Windows starts the app with this flag at sign-in; the app then stays in the tray.
const START_HIDDEN = process.argv.includes('--hidden');

let mainWindow = null;
let licenseWindow = null;
let locked = true;
let licenseState = { ok: false, reason: '' };
let updateReady = '';
let startingUp = true;
let panel = null;
let tray = null;
let quitting = false;
let paused = false;
let serverError = '';
let panelTarget = '0';
let lastStatus = '';
let registeredHotkeys = [];
let failedHotkeys = [];
const startedAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- storage -------------------------------------------------------------

const dataDir = () => app.getPath('userData');
const dataFile = () => path.join(dataDir(), 'quickreply.json');
const imageDir = () => path.join(dataDir(), 'images');
// Chrome loads the extension from this folder. It keeps one path across app updates.
const extensionDir = () => path.join(dataDir(), 'extension');

function extensionVersion(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version; } catch { return ''; }
}

// Copies the extension that came with this app version into the folder Chrome loads from.
// The running extension then sees the new version number and reloads itself.
function syncExtension() {
  if (extensionVersion(EXTENSION_SOURCE) === extensionVersion(extensionDir())) return;
  fs.cpSync(EXTENSION_SOURCE, extensionDir(), { recursive: true });
}

const SEED = {
  categories: ['ทั่วไป', 'ฝาก', 'ถอน', 'เกม', 'โปรโมชัน', 'บัญชี', 'อื่น ๆ'],
  replies: [
    { name: 'วิธีฝากเงิน', category: 'ฝาก', hotkey: 'Alt+1', favorite: true, text: 'สวัสดีครับคุณ {ชื่อ} ฝากเงินได้ตามขั้นตอนด้านล่างครับ' },
    { name: 'ขอหลักฐานการโอน', category: 'ฝาก', hotkey: 'Alt+2', favorite: false, text: 'คุณ {ชื่อ} รบกวนส่งสลิปการโอนเงินให้หน่อยครับ' },
    { name: 'วิธีเข้าเล่นเกม', category: 'เกม', hotkey: 'Alt+3', favorite: false, text: 'เข้าเล่นเกมได้ตามขั้นตอนด้านล่างครับ' },
  ].map((r) => ({ id: crypto.randomUUID(), images: [], lastUsedAt: 0, usageCount: 0, ...r })),
};

let db = null;

function loadDb() {
  fs.mkdirSync(imageDir(), { recursive: true });
  try {
    db = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    db = SEED;
    saveDb();
  }
  db.settings = { startWithWindows: true, ...db.settings };
}

function applyLoginItem() {
  // Only an installed copy registers itself; a development run would register electron.exe.
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: db.settings.startWithWindows, args: ['--hidden'] });
}

function saveDb() {
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dataFile());
}

const imagePath = (image) => path.join(imageDir(), image.file);

function repliesForUi() {
  return db.replies.map((r) => ({ ...r, images: r.images.map((img) => ({ ...img, path: imagePath(img) })) }));
}

// ---- license -------------------------------------------------------------

const licenseFile = () => path.join(dataDir(), 'license.json');
const DAY_MS = 86400000;

function machineId() {
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true });
    const guid = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(out)[1];
    return crypto.createHash('sha256').update(guid).digest('hex').slice(0, 8).toUpperCase();
  } catch {
    return 'UNKNOWN';
  }
}

const MACHINE_ID = machineId();

function readLicenseFile() {
  try { return JSON.parse(fs.readFileSync(licenseFile(), 'utf8')); } catch { return {}; }
}

// Checks the saved code (or a new one). A valid new code is saved.
function checkLicense(newCode) {
  const saved = readLicenseFile();
  const code = newCode || saved.code;
  const now = Date.now();
  let result;
  try {
    const publicKey = fs.readFileSync(path.join(__dirname, 'license-public.pem'), 'utf8');
    result = code ? license.verify(publicKey, code, MACHINE_ID, now) : { ok: false, reason: '' };
  } catch {
    result = { ok: false, reason: 'ไม่พบไฟล์ license-public.pem' };
  }
  // A clock set back more than a day would stretch an expired code.
  if (result.ok && saved.lastSeen && now + DAY_MS < saved.lastSeen) {
    result = { ...result, ok: false, reason: 'นาฬิกาเครื่องย้อนหลัง ตั้งเวลาให้ถูกแล้วเปิดโปรแกรมใหม่' };
  }
  if (result.ok || !newCode) {
    fs.writeFileSync(licenseFile(), JSON.stringify({ code: result.ok ? code : saved.code, lastSeen: Math.max(saved.lastSeen || 0, now) }));
  }
  return result;
}

function applyLicense(result) {
  licenseState = result;
  locked = !result.ok;
  if (locked) {
    if (panel) panel.hide();
    if (mainWindow) mainWindow.hide();
    showLicenseWindow();
  } else {
    if (licenseWindow) licenseWindow.destroy();
    licenseWindow = null;
    if (mainWindow && !(startingUp && START_HIDDEN)) showMainWindow();
  }
  startingUp = false;
  syncPanelHotkey();
  refresh();
  notifyExpiry();
}

const daysLeft = () => Math.floor((licenseState.expiresAt - Date.now()) / DAY_MS);

// One Windows notification per day while the code is close to its end.
function notifyExpiry() {
  const today = new Date().toDateString();
  if (!licenseState.ok || daysLeft() > EXPIRY_WARN_DAYS || db.settings.expiryNoticeOn === today) return;
  db.settings.expiryNoticeOn = today;
  saveDb();
  const when = daysLeft() > 0 ? `ในอีก ${daysLeft()} วัน` : 'วันนี้';
  new Notification({ title: 'QuickWai', body: `โค้ดใช้งานจะหมด${when} ส่งรหัสเครื่อง ${MACHINE_ID} ให้ผู้ดูแลเพื่อต่ออายุ` }).show();
}

function showLicenseWindow() {
  if (licenseWindow) return licenseWindow.show();
  licenseWindow = new BrowserWindow({ width: 460, height: 500, resizable: false, title: WINDOW_TITLE, icon: ICON, autoHideMenuBar: true, webPreferences });
  licenseWindow.loadFile(path.join(__dirname, 'ui', 'license.html'));
  licenseWindow.on('closed', () => {
    licenseWindow = null;
    if (locked) quit();
  });
}

// ---- updates -------------------------------------------------------------

async function runUpdateCheck() {
  if (updateReady) return { status: 'updated', version: updateReady };
  const result = await checkForUpdate({
    currentVersion: VERSION,
    publicKey: fs.readFileSync(path.join(__dirname, 'license-public.pem'), 'utf8'),
    updatesDir: path.join(dataDir(), 'updates'),
  });
  if (result.status === 'updated') {
    updateReady = result.version;
    new Notification({ title: 'QuickWai', body: `อัปเดต ${result.version} พร้อมแล้ว ปิดแล้วเปิดโปรแกรมใหม่เพื่อใช้` }).show();
    refresh();
  }
  return result;
}

// ---- export / import -----------------------------------------------------

async function exportData() {
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `quickreply-${stamp}.qrpack`, filters: [{ name: 'QuickWai', extensions: ['qrpack'] }] });
  if (result.canceled) return null;
  const pack = {
    format: 'quickreply-pack',
    version: 1,
    categories: db.categories,
    replies: db.replies.map((r) => ({
      ...r,
      lastUsedAt: 0,
      usageCount: 0,
      images: r.images.map((img) => ({ ...img, data: fs.readFileSync(imagePath(img)).toString('base64') })),
    })),
  };
  fs.writeFileSync(result.filePath, JSON.stringify(pack));
  return { count: pack.replies.length, file: result.filePath };
}

async function importData() {
  const picked = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'QuickWai', extensions: ['qrpack'] }] });
  if (picked.canceled) return null;
  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(picked.filePaths[0], 'utf8'));
    if (pack.format !== 'quickreply-pack' || !Array.isArray(pack.replies)) throw new Error('format');
  } catch {
    dialog.showMessageBox(mainWindow, { type: 'error', message: 'ไฟล์นี้ไม่ใช่ไฟล์ QuickWai หรือไฟล์เสีย' });
    return null;
  }
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    message: `นำเข้า ${pack.replies.length} Reply`,
    detail: 'รวม: เพิ่มเข้าไป Reply เดิมที่ตรงกันถูกอัปเดต\nแทนที่ทั้งหมด: ลบ Reply เดิมทุกอันก่อน',
    buttons: ['รวม', 'แทนที่ทั้งหมด', 'ยกเลิก'],
    cancelId: 2,
  });
  if (choice.response === 2) return null;
  if (choice.response === 1) db.replies = [];

  for (const incoming of pack.replies) {
    const images = (incoming.images || []).map((img) => {
      const file = path.basename(String(img.file));
      fs.writeFileSync(path.join(imageDir(), file), Buffer.from(img.data, 'base64'));
      return { id: String(img.id), file, name: String(img.name) };
    });
    const reply = {
      id: String(incoming.id),
      name: String(incoming.name),
      category: String(incoming.category),
      hotkey: String(incoming.hotkey || ''),
      text: String(incoming.text || ''),
      favorite: !!incoming.favorite,
      images,
      lastUsedAt: 0,
      usageCount: 0,
    };
    if (reply.hotkey) for (const other of db.replies) if (other.id !== reply.id && other.hotkey === reply.hotkey) other.hotkey = '';
    const index = db.replies.findIndex((r) => r.id === reply.id);
    if (index >= 0) db.replies[index] = { ...reply, lastUsedAt: db.replies[index].lastUsedAt, usageCount: db.replies[index].usageCount };
    else db.replies.push(reply);
  }
  for (const category of pack.categories || []) if (!db.categories.includes(category)) db.categories.push(String(category));
  saveDb();
  sendData();
  refresh();
  return { count: pack.replies.length };
}

// ---- extension link ------------------------------------------------------

const tabs = new Map();
let activeTab = null;

function onExtensionState(state) {
  const key = `${state.incognito ? 'i' : 'n'}:${state.tabId}`;
  tabs.set(key, { name: String(state.name || '').slice(0, 60), noteFound: !!state.noteFound, focused: !!state.focused, at: Date.now() });
  if (state.focused) activeTab = key;
  refresh();
}

function status() {
  const now = Date.now();
  for (const [key, tab] of tabs) if (now - tab.at > STALE_MS) tabs.delete(key);
  const current = tabs.get(activeTab) || [...tabs.values()].sort((a, b) => b.at - a.at)[0];
  return {
    extConnected: tabs.size > 0,
    name: current ? current.name : '',
    noteFound: current ? current.noteFound : false,
    chatFocused: [...tabs.values()].some((tab) => tab.focused),
    paused,
    serverError,
    failedHotkeys,
    panelHotkey: PANEL_HOTKEY,
    startedAt,
    license: licenseState,
    machineId: MACHINE_ID,
    expiryWarnDays: EXPIRY_WARN_DAYS,
    startWithWindows: db.settings.startWithWindows,
    installed: app.isPackaged,
    version: VERSION,
    updateReady,
  };
}

function startServer() {
  const server = http.createServer((req, res) => {
    const fromExtension = req.headers['x-quickreply'] === '1' && String(req.headers.origin || '').startsWith('chrome-extension://');
    if (req.method !== 'POST' || req.url !== '/state' || !fromExtension) {
      res.writeHead(403).end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try {
        onExtensionState(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ extensionVersion: extensionVersion(extensionDir()) }));
      } catch {
        res.writeHead(400).end();
      }
    });
  });
  server.on('error', (err) => {
    serverError = err.code === 'EADDRINUSE' ? `พอร์ต ${PORT} ถูกใช้อยู่` : err.message;
    refresh();
  });
  server.listen(PORT, '127.0.0.1');
}

// ---- keyboard helper (foreground window + Ctrl+V) ------------------------

let helper = null;
const helperQueue = [];

function startHelper() {
  helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'helper.ps1')], { windowsHide: true });
  readline.createInterface({ input: helper.stdout }).on('line', (line) => {
    const resolve = helperQueue.shift();
    if (resolve) resolve(line.trim());
  });
  helper.on('error', () => {});
  helper.on('exit', () => {
    helper = null;
    helperQueue.splice(0).forEach((resolve) => resolve('fail'));
  });
}

function askHelper(command) {
  return new Promise((resolve) => {
    if (!helper) return resolve('fail');
    helperQueue.push(resolve);
    helper.stdin.write(command + '\n');
  });
}

// ---- paste ---------------------------------------------------------------

async function useReply(id, name, imageIds, target) {
  const reply = db.replies.find((r) => r.id === id);
  if (!reply) return;
  const text = fillName(reply.text || '', name).trim();
  const images = reply.images.filter((img) => !imageIds || imageIds.includes(img.id));
  const before = clipboard.readText();
  let pasted = 0;

  if (text) {
    clipboard.writeText(text);
    if ((await askHelper(`paste ${target}`)) !== 'ok') return pasteFailed('ข้อความอยู่ใน Clipboard แล้ว กด Ctrl + V เอง');
    pasted++;
  }
  if (images.length) {
    if (pasted) await sleep(PASTE_GAP_MS);
    // All images go in one paste; LINE OA then shows one confirm dialog for the whole set.
    const paths = Buffer.from(images.map(imagePath).join('|'), 'utf8').toString('base64');
    if ((await askHelper(`files ${paths}`)) !== 'ok') return pasteFailed('เตรียมรูปไม่สำเร็จ');
    if ((await askHelper(`paste ${target}`)) !== 'ok') return pasteFailed('วางรูปไม่ได้ รูปอยู่ใน Clipboard แล้ว กด Ctrl + V เอง');
  }

  // Put the earlier clipboard text back. Some clipboard contents cannot be written back; skip those.
  if (before) setTimeout(() => { try { clipboard.writeText(before); } catch {} }, 1500);
  reply.lastUsedAt = Date.now();
  reply.usageCount = (reply.usageCount || 0) + 1;
  saveDb();
  sendData();
}

function pasteFailed(detail) {
  new Notification({ title: 'QuickWai: วางไม่สำเร็จ', body: detail || 'กลับไปที่หน้าต่างแชทแล้วลองใหม่' }).show();
}

// ---- hotkeys -------------------------------------------------------------

async function onReplyHotkey(id) {
  const reply = db.replies.find((r) => r.id === id);
  if (!reply) return;
  const target = await askHelper('fg');
  const { name } = status();
  if (needsName(reply.text) && !name) return openPanel({ askFor: id, target });
  useReply(id, name, null, target);
}

// Reply hotkeys are live only while the LINE OA chat tab has focus, so they do not take keys from other apps.
function syncHotkeys() {
  const wanted = !paused && !locked && status().chatFocused
    ? db.replies.filter((r) => r.hotkey).map((r) => `${r.hotkey}|${r.id}`)
    : [];
  if (wanted.join() === registeredHotkeys.join()) return;

  for (const entry of registeredHotkeys) globalShortcut.unregister(entry.split('|')[0]);
  registeredHotkeys = wanted;
  failedHotkeys = [];
  for (const entry of wanted) {
    const [accelerator, id] = entry.split('|');
    let ok = false;
    try { ok = globalShortcut.register(accelerator, () => onReplyHotkey(id)); } catch {}
    if (!ok) failedHotkeys.push(accelerator);
  }
}

function syncPanelHotkey() {
  globalShortcut.unregister(PANEL_HOTKEY);
  if (!paused && !locked) globalShortcut.register(PANEL_HOTKEY, () => openPanel({}));
}

// ---- windows -------------------------------------------------------------

const webPreferences = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false };

function createMainWindow() {
  mainWindow = new BrowserWindow({ width: 760, height: 640, minWidth: 560, minHeight: 460, title: WINDOW_TITLE, icon: ICON, autoHideMenuBar: true, show: false, webPreferences });
  mainWindow.loadFile(path.join(__dirname, 'ui', 'main.html'));
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

function createPanel() {
  panel = new BrowserWindow({ width: 440, height: 480, show: false, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, webPreferences });
  panel.loadFile(path.join(__dirname, 'ui', 'panel.html'));
  panel.on('blur', () => panel.hide());
  panel.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    panel.hide();
  });
}

async function openPanel({ askFor, target }) {
  if (locked) return;
  if (panel.isVisible()) return panel.hide();
  panelTarget = target || (await askHelper('fg'));
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const [width, height] = panel.getSize();
  panel.setPosition(Math.round(area.x + (area.width - width) / 2), Math.round(area.y + (area.height - height) / 3));
  panel.webContents.send('panel:open', { status: status(), replies: repliesForUi(), askFor: askFor || null });
  panel.show();
  panel.focus();
}

function showMainWindow() {
  if (locked) return showLicenseWindow();
  mainWindow.show();
  mainWindow.focus();
}

function trayIcon(connected) {
  return nativeImage.createFromPath(path.join(ASSETS, connected ? 'tray-on.png' : 'tray-off.png'));
}

function updateTray(current) {
  tray.setImage(trayIcon(current.extConnected));
  tray.setToolTip(`${WINDOW_TITLE}\n${current.paused ? 'หยุดชั่วคราว' : 'ทำงานอยู่'} · Extension ${current.extConnected ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Extension: ${current.extConnected ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}`, enabled: false },
    { type: 'separator' },
    { label: 'เปิด QuickWai', click: showMainWindow },
    { label: 'ค้นหาด่วน', click: () => openPanel({}) },
    { label: 'หยุด Hotkey ชั่วคราว', type: 'checkbox', checked: current.paused, click: (item) => setPaused(item.checked) },
    { type: 'separator' },
    { label: 'ออกจากโปรแกรม', click: quit },
  ]));
}

function quit() {
  quitting = true;
  app.quit();
}

function setPaused(value) {
  paused = value;
  syncPanelHotkey();
  refresh();
}

function sendToWindows(channel, payload) {
  for (const win of [mainWindow, panel]) if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function sendData() {
  sendToWindows('data', { replies: repliesForUi(), categories: db.categories });
}

function refresh() {
  syncHotkeys();
  const current = status();
  const serialized = JSON.stringify(current);
  if (serialized === lastStatus) return;
  lastStatus = serialized;
  sendToWindows('status', current);
  if (tray) updateTray(current);
}

// ---- IPC -----------------------------------------------------------------

ipcMain.handle('init', () => ({ replies: repliesForUi(), categories: db.categories, status: status(), extensionDir: extensionDir(), dataDir: dataDir() }));

ipcMain.handle('reply:save', (_event, input) => {
  const fields = {
    name: String(input.name || '').trim(),
    category: String(input.category || db.categories[0]),
    hotkey: String(input.hotkey || ''),
    text: String(input.text || ''),
    favorite: !!input.favorite,
    images: (input.images || []).map(({ id, file, name }) => ({ id, file, name })),
  };
  if (fields.hotkey) for (const other of db.replies) if (other.id !== input.id && other.hotkey === fields.hotkey) other.hotkey = '';
  const existing = db.replies.find((r) => r.id === input.id);
  if (existing) Object.assign(existing, fields);
  else db.replies.push({ id: crypto.randomUUID(), lastUsedAt: 0, usageCount: 0, ...fields });
  saveDb();
  sendData();
  refresh();
});

ipcMain.handle('reply:delete', (_event, id) => {
  db.replies = db.replies.filter((r) => r.id !== id);
  saveDb();
  sendData();
  refresh();
});

ipcMain.handle('image:add', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'รูปภาพ', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
  });
  if (result.canceled) return [];
  return result.filePaths.map((source) => {
    const image = { id: crypto.randomUUID(), name: path.basename(source) };
    image.file = image.id + path.extname(source).toLowerCase();
    fs.copyFileSync(source, imagePath(image));
    return { ...image, path: imagePath(image) };
  });
});

ipcMain.handle('panel:use', async (_event, { id, name, imageIds }) => {
  panel.hide();
  await sleep(60);
  await useReply(id, String(name || '').trim(), imageIds || null, panelTarget);
});

ipcMain.handle('panel:hide', () => panel.hide());
ipcMain.handle('app:quit', quit);
ipcMain.handle('update:check', runUpdateCheck);
ipcMain.handle('data:export', exportData);
ipcMain.handle('data:import', importData);
ipcMain.handle('license:info', () => ({ machineId: MACHINE_ID, reason: licenseState.reason, locked }));
ipcMain.handle('license:open', showLicenseWindow);
ipcMain.handle('license:close', () => (locked ? quit() : licenseWindow && licenseWindow.close()));
ipcMain.handle('settings:set', (_event, { startWithWindows }) => {
  db.settings.startWithWindows = !!startWithWindows;
  saveDb();
  applyLoginItem();
  refresh();
});
ipcMain.handle('license:activate', (_event, code) => {
  const result = checkLicense(String(code));
  if (result.ok) applyLicense(result);
  return result;
});
ipcMain.handle('ext:openFolder', () => shell.openPath(extensionDir()));
ipcMain.handle('data:openFolder', () => shell.openPath(dataDir()));
ipcMain.handle('clip:copy', (_event, text) => clipboard.writeText(String(text)));

// ---- lifecycle -----------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
  app.whenReady().then(() => {
    loadDb();
    applyLoginItem();
    syncExtension();
    startHelper();
    startServer();
    createMainWindow();
    createPanel();
    tray = new Tray(trayIcon(false));
    tray.on('click', showMainWindow);
    applyLicense(checkLicense());
    setInterval(refresh, 1000);
    setTimeout(runUpdateCheck, 60000);
    setInterval(runUpdateCheck, UPDATE_CHECK_MS);
    // Lock the app when the code expires while it is running.
    setInterval(() => {
      if (locked) return;
      const result = checkLicense();
      if (!result.ok) applyLicense(result);
      else notifyExpiry();
    }, 3600000);
  });
  app.on('window-all-closed', () => {});
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (helper) helper.kill();
  });
}
