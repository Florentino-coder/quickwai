// Offline activation codes. The owner signs a code with the private key; the app checks it
// with the public key only, so no network is needed and nobody else can issue codes.
const crypto = require('crypto');

const PREFIX = 'QR1.';
const b64 = (data) => Buffer.from(data).toString('base64url');

function issue(privateKey, { name, expiresAt, machine }) {
  const payload = b64(JSON.stringify({ n: name, e: expiresAt, m: machine || '' }));
  return `${PREFIX}${payload}.${b64(crypto.sign(null, Buffer.from(payload), privateKey))}`;
}

function verify(publicKey, code, machineId, now = Date.now()) {
  const invalid = { ok: false, reason: 'โค้ดไม่ถูกต้อง' };
  const clean = String(code || '').replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) return invalid;
  const [payload, signature] = clean.slice(PREFIX.length).split('.');
  if (!payload || !signature) return invalid;
  try {
    if (!crypto.verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, 'base64url'))) return invalid;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const info = { name: data.n, expiresAt: data.e };
    if (data.m && data.m !== machineId) return { ok: false, reason: 'โค้ดนี้ออกให้เครื่องอื่น', ...info };
    if (now > data.e) return { ok: false, reason: 'โค้ดหมดอายุแล้ว', ...info };
    return { ok: true, ...info };
  } catch {
    return invalid;
  }
}

module.exports = { issue, verify };
