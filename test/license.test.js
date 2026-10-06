const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { issue, verify } = require('../desktop/license.js');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const DAY = 86400000;
const now = Date.now();

test('a signed code is accepted until it expires', () => {
  const code = issue(privateKey, { name: 'มายด์', expiresAt: now + DAY });
  assert.deepEqual(verify(publicKey, code, 'AAAA1111', now), { ok: true, name: 'มายด์', expiresAt: now + DAY });
  assert.equal(verify(publicKey, `  ${code.slice(0, 20)}\n${code.slice(20)} `, 'AAAA1111', now).ok, true);
  assert.equal(verify(publicKey, code, 'AAAA1111', now + 2 * DAY).reason, 'โค้ดหมดอายุแล้ว');
});

test('a machine-bound code works on that machine only', () => {
  const code = issue(privateKey, { name: 'A', expiresAt: now + DAY, machine: 'AAAA1111' });
  assert.equal(verify(publicKey, code, 'AAAA1111', now).ok, true);
  assert.equal(verify(publicKey, code, 'BBBB2222', now).reason, 'โค้ดนี้ออกให้เครื่องอื่น');
});

test('edited or foreign codes are rejected', () => {
  const code = issue(privateKey, { name: 'A', expiresAt: now + DAY });
  const [payload, signature] = code.slice(4).split('.');
  const longer = Buffer.from(JSON.stringify({ n: 'A', e: now + 365 * DAY, m: '' })).toString('base64url');
  assert.equal(verify(publicKey, `QR1.${longer}.${signature}`, 'X', now).ok, false);
  const other = crypto.generateKeyPairSync('ed25519');
  assert.equal(verify(publicKey, issue(other.privateKey, { name: 'A', expiresAt: now + DAY }), 'X', now).ok, false);
  for (const junk of ['', 'hello', 'QR1.', 'QR1.abc', `QR1.${payload}.`]) assert.equal(verify(publicKey, junk, 'X', now).ok, false);
});
