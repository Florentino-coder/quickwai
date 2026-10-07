// Renders each section of docs/index.html to a PNG for sharing in chat.
// Run with: npx electron tools/make-guide-images.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const docs = path.join(__dirname, '..', 'docs');
const SECTIONS = { install: '1-ติดตั้งโปรแกรม', extension: '2-ติดตั้งส่วนเสริม', prepare: '3-เตรียมแชท', reply: '4-สร้างข้อความ', use: '5-ตอบลูกค้า', help: '6-แก้ปัญหา' };

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 832, height: 900, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(docs, 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 800));
  win.webContents.debugger.attach();
  fs.mkdirSync(path.join(docs, 'guide'), { recursive: true });

  for (const [id, name] of Object.entries(SECTIONS)) {
    const box = await win.webContents.executeJavaScript(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return { x: r.x + scrollX - 8, y: r.y + scrollY - 8, width: r.width + 16, height: r.height + 16 }; })()`);
    const { data } = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...box, scale: 1.5 } });
    fs.writeFileSync(path.join(docs, 'guide', `คู่มือ-${name}.png`), Buffer.from(data, 'base64'));
  }
  app.quit();
});
