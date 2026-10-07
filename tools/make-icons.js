// Renders the app icon set from the SVG below. Run with: npx electron tools/make-icons.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svg = (background) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="56" fill="${background}"/>
  <path fill="#fff" d="M128 52c-50 0-88 31-88 72 0 24 13 45 34 58l-8 32c-1 4 3 7 7 5l40-22c5 1 10 1 15 1 50 0 88-31 88-74s-38-72-88-72z"/>
  <path fill="${background}" d="M140 78l-42 56h28l-10 44 44-58h-28z"/>
</svg>`;

async function render(win, background, size) {
  win.setContentSize(size, size);
  const html = `<body style="margin:0;background:transparent;overflow:hidden">${svg(background).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((resolve) => setTimeout(resolve, 150));
  return (await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })).resize({ width: size, height: size }).toPNG();
}

// An .ico file may hold PNG images directly.
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true, zoomFactor: 1 } });
  const blue = '#2563eb';
  const gray = '#8a8f98';
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.mkdirSync(path.join(root, 'desktop', 'assets'), { recursive: true });

  const sizes = [16, 32, 48, 256];
  const images = [];
  for (const size of sizes) images.push({ size, png: await render(win, blue, size) });
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico(images));
  fs.writeFileSync(path.join(root, 'desktop', 'assets', 'icon.png'), images[3].png);
  fs.writeFileSync(path.join(root, 'desktop', 'assets', 'tray-on.png'), images[1].png);
  fs.writeFileSync(path.join(root, 'desktop', 'assets', 'tray-off.png'), await render(win, gray, 32));
  for (const size of [16, 48]) fs.writeFileSync(path.join(root, 'extension', `icon${size}.png`), images[sizes.indexOf(size)].png);
  fs.writeFileSync(path.join(root, 'extension', 'icon128.png'), await render(win, blue, 128));
  app.quit();
});
