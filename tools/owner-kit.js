// Owner-only tool. Builds the owner-kit/ folder: everything needed to issue codes on any
// computer, with no Node and no internet. The folder holds the private key; never share it.
//   node tools/owner-kit.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'owner-kit');
const page = fs.readFileSync(path.join(__dirname, 'issuer.html'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, 'issuer-core.js'), 'utf8');

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'ออกโค้ด QuickWai.html'), page.replace('<script src="issuer-core.js"></script>', () => `<script>\n${core}</script>`));
fs.copyFileSync(path.join(root, 'license-private.pem'), path.join(out, 'license-private.pem'));
fs.writeFileSync(path.join(out, 'อ่านก่อน.txt'), `ชุดออกโค้ด QuickWai

วิธีออกโค้ด
1. ดับเบิลคลิกไฟล์ "ออกโค้ด QuickWai.html" (เปิดด้วย Chrome)
2. กดเลือกไฟล์ license-private.pem ที่อยู่ในโฟลเดอร์นี้
3. ใส่ชื่อผู้ใช้ จำนวนวัน และรหัสเครื่องที่ผู้ใช้ส่งมา
4. กด "ออกโค้ด" แล้วคัดลอกโค้ดส่งให้ผู้ใช้

ไม่ต้องใช้อินเทอร์เน็ต ใช้ได้บนคอมพิวเตอร์เครื่องไหนก็ได้

ข้อควรระวัง
- license-private.pem คือกุญแจ ใครมีไฟล์นี้ออกโค้ดและออกอัปเดตได้ ห้ามส่งให้ใคร
- เก็บสำเนาโฟลเดอร์นี้ไว้อย่างน้อย 2 ที่ เช่น USB และ Google Drive ส่วนตัว
- ถ้าไฟล์กุญแจหาย ต้องสร้างกุญแจใหม่ ทุกเครื่องต้องติดตั้งโปรแกรมใหม่และขอโค้ดใหม่
- ตาราง "โค้ดที่ออกไปแล้ว" เก็บในเบราว์เซอร์ของเครื่องที่ใช้ออกโค้ด ไม่ตามไปเครื่องอื่น
`);
console.log(`สร้างชุดออกโค้ดแล้ว: ${out}`);
