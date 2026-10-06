// Code-only updates from the GitHub repo. A check downloads one small JSON file; an update
// downloads one compressed bundle of the desktop/ folder, signed with the owner's private key.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { isNewer } = require('./version.js');

const BASE_URL = 'https://raw.githubusercontent.com/Florentino-coder/quickwai/main/updates/';

async function download(name) {
  const res = await fetch(BASE_URL + name, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function unpack(bundle, publicKey, signature, expectedVersion, updatesDir) {
  if (!crypto.verify(null, bundle, publicKey, Buffer.from(signature, 'base64'))) throw new Error('ลายเซ็นของไฟล์อัปเดตไม่ถูกต้อง');
  const { version, files } = JSON.parse(zlib.gunzipSync(bundle).toString('utf8'));
  if (version !== expectedVersion) throw new Error('เวอร์ชันของไฟล์อัปเดตไม่ตรง');

  const target = path.join(updatesDir, version);
  const staging = target + '.tmp';
  fs.rmSync(staging, { recursive: true, force: true });
  for (const [name, data] of Object.entries(files)) {
    const file = path.join(staging, name);
    if (!file.startsWith(staging + path.sep)) throw new Error('ไฟล์อัปเดตมีที่อยู่ไฟล์ไม่ถูกต้อง');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(staging, target);
  fs.writeFileSync(path.join(updatesDir, 'current.json'), JSON.stringify({ version }));
}

// Returns { status: 'current' | 'updated' | 'error', version?, message? }.
async function checkForUpdate({ currentVersion, publicKey, updatesDir }) {
  try {
    const latest = JSON.parse((await download('latest.json')).toString('utf8'));
    if (!isNewer(latest.version, currentVersion)) return { status: 'current' };
    unpack(await download(latest.file), publicKey, latest.signature, latest.version, updatesDir);
    return { status: 'updated', version: latest.version };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

module.exports = { checkForUpdate, unpack };
