// Owner-only tool. Keep license-private.pem secret: anyone who has it can issue codes.
//   node tools/license.js keygen
//   node tools/license.js issue --name "สมชาย" --days 30 [--machine A1B2C3D4]
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { issue } = require('../desktop/license.js');

const PRIVATE = path.join(__dirname, '..', 'license-private.pem');
const PUBLIC = path.join(__dirname, '..', 'desktop', 'license-public.pem');
const ISSUED = path.join(__dirname, '..', 'license-issued.csv');
const [command, ...rest] = process.argv.slice(2);
const option = (name) => { const i = rest.indexOf('--' + name); return i >= 0 ? rest[i + 1] : undefined; };

if (command === 'keygen') {
  if (fs.existsSync(PRIVATE)) {
    console.error('มี license-private.pem อยู่แล้ว สร้างใหม่จะทำให้โค้ดเก่าทั้งหมดใช้ไม่ได้ ลบไฟล์เองก่อนถ้าต้องการสร้างใหม่');
    process.exit(1);
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(PRIVATE, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.writeFileSync(PUBLIC, publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('สร้างกุญแจแล้ว เก็บ license-private.pem ไว้กับตัว ห้ามส่งให้ใคร');
} else if (command === 'issue') {
  const days = Number(option('days'));
  const name = option('name');
  if (!name || !(days > 0)) {
    console.error('ใช้: node tools/license.js issue --name "ชื่อ" --days 30 [--machine รหัสเครื่อง]');
    process.exit(1);
  }
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  expires.setHours(23, 59, 59, 999);
  const machine = (option('machine') || '').toUpperCase();
  console.log(`ชื่อ: ${name}`);
  console.log(`หมดอายุ: ${expires.toLocaleDateString('th-TH', { dateStyle: 'long' })}`);
  console.log(`เครื่อง: ${machine || 'ใช้ได้ทุกเครื่อง'}`);
  console.log('');
  console.log(issue(fs.readFileSync(PRIVATE, 'utf8'), { name, expiresAt: expires.getTime(), machine }));
  // Local record of who got a code; never committed.
  if (!fs.existsSync(ISSUED)) fs.writeFileSync(ISSUED, '\ufeffออกเมื่อ,ชื่อ,รหัสเครื่อง,หมดอายุ\n');
  const day = (date) => date.toLocaleDateString('sv-SE');
  fs.appendFileSync(ISSUED, `${day(new Date())},"${name.replace(/"/g, '""')}",${machine || 'ทุกเครื่อง'},${day(expires)}\n`);
} else {
  console.error('คำสั่ง: keygen | issue');
  process.exit(1);
}
