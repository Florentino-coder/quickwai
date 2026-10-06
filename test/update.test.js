const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { isNewer } = require('../desktop/version.js');
const { unpack } = require('../desktop/updater.js');
const { verify } = require('../desktop/license.js');
const { issueCode } = require('../tools/issuer-core.js');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

function makeBundle(version, files) {
  const bundle = zlib.gzipSync(JSON.stringify({ version, files }));
  return { bundle, signature: crypto.sign(null, bundle, privateKey).toString('base64') };
}

test('isNewer compares version numbers', () => {
  assert.equal(isNewer('0.1.1', '0.1.0'), true);
  assert.equal(isNewer('0.10.0', '0.9.9'), true);
  assert.equal(isNewer('0.1.0', '0.1.0'), false);
  assert.equal(isNewer('0.1.0', '0.2.0'), false);
});

test('a signed update is unpacked and becomes current', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-update-'));
  const { bundle, signature } = makeBundle('0.2.0', { 'desktop/main.js': Buffer.from('// new').toString('base64') });
  unpack(bundle, publicPem, signature, '0.2.0', dir);
  assert.equal(fs.readFileSync(path.join(dir, '0.2.0', 'desktop', 'main.js'), 'utf8'), '// new');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'current.json'), 'utf8')), { version: '0.2.0' });
});

test('a tampered or unsafe update is refused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-update-'));
  const good = makeBundle('0.2.0', { 'desktop/main.js': '' });
  const tampered = Buffer.from(good.bundle);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => unpack(tampered, publicPem, good.signature, '0.2.0', dir));
  assert.throws(() => unpack(good.bundle, publicPem, good.signature, '0.3.0', dir));
  const escape = makeBundle('0.2.0', { '../../evil.js': '' });
  assert.throws(() => unpack(escape.bundle, publicPem, escape.signature, '0.2.0', dir));
  assert.equal(fs.existsSync(path.join(dir, 'current.json')), false);
});

test('the issuer page makes codes the app accepts', async () => {
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const expiresAt = Date.now() + 86400000;
  const code = await issueCode(privatePem, { name: 'มายด์', expiresAt, machine: 'AAAA1111' });
  assert.deepEqual(verify(publicPem, code, 'AAAA1111'), { ok: true, name: 'มายด์', expiresAt });
});
