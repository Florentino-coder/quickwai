// Owner-only tool. Builds a signed update from the desktop/ and extension/ folders.
//   node tools/release.js 0.1.1
// Then commit and push; running apps pick the update up at their next check.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { isNewer } = require('../desktop/version.js');

const root = path.join(__dirname, '..');
const version = process.argv[2];
const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(version || '') || !isNewer(version, pkg.version)) {
  console.error(`ใส่เลขเวอร์ชันที่ใหม่กว่า ${pkg.version} เช่น node tools/release.js 0.1.1`);
  process.exit(1);
}

function collect(dir, files = {}) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collect(rel, files);
    else files[rel] = fs.readFileSync(path.join(root, rel)).toString('base64');
  }
  return files;
}

// The extension takes the app's version number, so running copies notice the change and reload.
const manifestFile = path.join(root, 'extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, version }, null, 2) + '\n');

const bundle = zlib.gzipSync(JSON.stringify({ version, files: collect('extension', collect('desktop')) }), { level: 9 });
const signature = crypto.sign(null, bundle, fs.readFileSync(path.join(root, 'license-private.pem'), 'utf8')).toString('base64');
const file = `app-${version}.bin`;
const outDir = path.join(root, 'updates');

fs.mkdirSync(outDir, { recursive: true });
for (const old of fs.readdirSync(outDir)) if (old.endsWith('.bin')) fs.rmSync(path.join(outDir, old));
fs.writeFileSync(path.join(outDir, file), bundle);
fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify({ version, file, size: bundle.length, signature }));
fs.writeFileSync(pkgFile, JSON.stringify({ ...pkg, version }, null, 2) + '\n');

console.log(`สร้างอัปเดต ${version} แล้ว ขนาด ${(bundle.length / 1024).toFixed(1)} KB`);
console.log('ขั้นต่อไป: git add -A && git commit -m "Release ' + version + '" && git push');
