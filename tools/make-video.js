// Builds the silent guide video docs/guide/QuickWai-guide.mp4 from the slides below.
// Run with: npx electron tools/make-video.js   (takes about as long as the video itself)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const docs = path.join(__dirname, '..', 'docs');
const WIDTH = 1280;
const HEIGHT = 720;
const SECONDS_PER_SLIDE = 6;
const FADE_MS = 400;

const img = (name) => `<img src="img/${name}.png">`;
const mock = (html) => `<div class="mockwrap">${html}</div>`;
const key = (text) => `<b class="k">${text}</b>`;
const btn = (text) => `<b class="btn">${text}</b>`;

// part: section label. n: step number inside the part. text: what to do. show: picture or drawing.
const SLIDES = [
  { cover: true, title: 'คู่มือ QuickWai', text: 'ตอบแชท LINE OA ด้วยปุ่มเดียว<br>ตั้งค่าครั้งเดียว 3 ส่วน ราว 10 นาที' },

  { part: 'ส่วนที่ 1 ติดตั้งโปรแกรม', n: 1, text: `ดับเบิลคลิกไฟล์ ${key('QuickWai-Setup')} ที่ได้รับ`, show: mock(`<div class="mock"><div class="body row"><img src="img/icon.png" width="44" height="44"><div><b>QuickWai-Setup</b><br><span style="color:#6b7280">Application</span></div></div></div>`) },
  { part: 'ส่วนที่ 1 ติดตั้งโปรแกรม', n: 2, text: `ถ้าขึ้นหน้าต่างสีฟ้า กด ${btn('More info')} แล้วกด ${btn('Run anyway')}`, show: mock(`<div class="mock blue"><div class="body"><div style="font-size:17px;margin-bottom:6px">Windows protected your PC</div><div>Microsoft Defender SmartScreen prevented an unrecognized app from starting. <u class="hl">More info</u></div><div style="text-align:right;margin-top:16px"><span class="winbtn hl">Run anyway</span><span class="winbtn">Don't run</span></div></div></div>`) },
  { part: 'ส่วนที่ 1 ติดตั้งโปรแกรม', n: 3, text: `โปรแกรมขึ้นหน้าใส่โค้ด กด ${btn('คัดลอกรหัสเครื่อง')} ส่งให้ผู้ดูแลพร้อมชื่อของคุณ`, show: img('license') },
  { part: 'ส่วนที่ 1 ติดตั้งโปรแกรม', n: 4, text: `วางโค้ดที่ผู้ดูแลส่งกลับมา กด ${btn('เริ่มใช้งาน')} เข้าโปรแกรมได้แล้ว`, show: img('main-off') },

  { part: 'ส่วนที่ 2 ติดตั้ง Extension', n: 1, text: `ในโปรแกรม กดป้าย ${btn('Extension ไม่ได้เชื่อมต่อ')} มุมขวาบน เปิดหน้าต่างนี้ค้างไว้`, show: img('ext-guide') },
  { part: 'ส่วนที่ 2 ติดตั้ง Extension', n: 2, text: `เปิด Chrome พิมพ์ ${key('chrome://extensions')} กด Enter แล้วเปิดสวิตช์ ${btn('Developer mode')}`, show: mock(`<div class="mock"><div class="bar"><span class="url hl">chrome://extensions</span></div><div class="body row"><b>Extensions</b><span class="grow"></span><span class="hl">Developer mode <span class="toggle"></span></span></div></div>`) },
  { part: 'ส่วนที่ 2 ติดตั้ง Extension', n: 3, text: `กดปุ่ม ${btn('Load unpacked')} ด้านซ้ายบน`, show: mock(`<div class="mock"><div class="body row" style="gap:8px"><span class="mbtn hl">Load unpacked</span><span class="mbtn">Pack extension</span><span class="mbtn">Update</span></div></div>`) },
  { part: 'ส่วนที่ 2 ติดตั้ง Extension', n: 4, text: `ในโปรแกรม กด ${btn('คัดลอก')} หลังที่อยู่โฟลเดอร์ วางในช่องที่อยู่ กด Enter แล้วกด ${btn('Select Folder')}<br><small>หน้าต่างเลือกโฟลเดอร์ดูว่างเปล่า ถูกแล้ว</small>`, show: mock(`<div class="mock"><div class="bar"><span class="url hl">...\\AppData\\Roaming\\QuickWai\\extension</span></div><div class="body" style="height:90px;color:#9aa1ab">No items match your search.</div><div class="body row" style="border-top:1px solid #d9dde3"><span class="grow"></span><span class="mbtn hl" style="border-radius:6px">Select Folder</span><span class="mbtn" style="border-radius:6px;color:#1f2933">Cancel</span></div></div>`) },
  { part: 'ส่วนที่ 2 ติดตั้ง Extension', n: 5, text: `เปิดหน้า LINE OA กด ${key('F5')} เปิดแชทและแถบโน้ต ป้ายในโปรแกรมเป็นสีเขียว`, show: img('main-on') },
  { part: 'ส่วนที่ 2 ติดตั้ง Extension', n: 6, text: `ใช้ Incognito: กด ${btn('Details')} ของ QuickWai Note Reader แล้วเปิด ${btn('Allow in Incognito')}`, show: mock(`<div class="mock"><div class="body"><div class="row"><img src="img/icon.png" width="32" height="32"><div><b>QuickWai Note Reader</b><br><span style="color:#6b7280">อ่านชื่อลูกค้าจากโน้ตใน LINE OA</span></div></div><div class="row" style="margin-top:12px"><span class="mbtn hl">Details</span><span class="mbtn">Remove</span><span class="grow"></span><span class="toggle"></span></div></div></div>`) },

  { part: 'ส่วนที่ 3 ใช้งาน', n: 1, text: `ในโน้ตของแชท เขียน ${key('ชื่อ มายด์')} หรือ ${key('พี่บราวน์')}`, show: mock(`<div class="mock" style="max-width:300px"><div class="body"><div class="row"><b>โน้ต 1/1</b><span class="grow"></span><span style="color:#06c755;font-size:18px">+</span></div><div class="notecard hl">ชื่อ มายด์</div></div></div>`) },
  { part: 'ส่วนที่ 3 ใช้งาน', n: 2, text: 'ใส่แท็กให้แชท ป้าย QuickWai บนหน้าแชทบอกว่าขาดอะไร<br><small>แดง: ไม่มีชื่อ เหลือง: ไม่มีแท็ก เขียว: ครบ</small>', show: mock(`<div><span class="badge bad"><b>QuickWai: ยังไม่มีโน้ตชื่อ และ แท็ก</b>✗ โน้ตชื่อลูกค้า: ยังไม่มี<br>✗ แท็ก: ยังไม่ใส่</span><br><span class="badge warn"><b>QuickWai: ยังไม่มีแท็ก</b>✓ โน้ตชื่อลูกค้า: มายด์<br>✗ แท็ก: ยังไม่ใส่</span><br><span class="badge good">✓ QuickWai: มายด์ · มีแท็ก</span></div>`) },
  { part: 'ส่วนที่ 3 ใช้งาน', n: 3, text: `กด ${btn('+ เพิ่ม Reply')} ตั้ง Hotkey พิมพ์ข้อความ กด ${btn('แทรก {ชื่อ}')} เพิ่มรูปได้ แล้วกด ${btn('บันทึก')}`, show: img('editor') },
  { part: 'ส่วนที่ 3 ใช้งาน', n: 4, text: `ตอบลูกค้า: คลิกช่องพิมพ์ข้อความในแชท แล้วกด Hotkey เช่น ${key('Alt')} + ${key('1')}`, show: mock(`<div class="mock"><div class="body"><div style="color:#6b7280">ลูกค้า: ฝากยังไงคะ</div><div class="notecard hl" style="margin-top:14px">สวัสดีครับคุณ มายด์ ฝากเงินได้ตามขั้นตอนด้านล่างครับ</div></div></div>`) },
  { part: 'ส่วนที่ 3 ใช้งาน', n: 5, text: `ตรวจข้อความ กด ${key('Enter')} เพื่อส่ง ถ้ามีรูป LINE ถามยืนยัน กด ${btn('ส่ง')}`, show: mock(`<div class="mock" style="max-width:420px"><div class="body"><b>ต้องการส่งไฟล์ในห้องแชทนี้หรือไม่</b><div class="row" style="margin-top:12px;gap:8px"><span style="width:64px;height:64px;border-radius:8px;background:#fde9a8;display:inline-block"></span><span style="width:64px;height:64px;border-radius:8px;background:#c9dcfb;display:inline-block"></span></div><div style="text-align:right;margin-top:12px"><span class="mbtn" style="color:#1f2933;border-radius:6px">ยกเลิก</span> <span class="mbtn green hl">ส่ง</span></div></div></div>`) },
  { part: 'ส่วนที่ 3 ใช้งาน', n: 6, text: `จำ Hotkey ไม่ได้: กด ${key('Ctrl')} + ${key('Space')} พิมพ์ค้นหา แล้วกด ${key('Enter')}`, show: img('panel') },
  { part: 'ส่วนที่ 3 ใช้งาน', n: 7, text: `${btn('ตั้งค่าและข้อมูล')}: ส่งออก นำเข้าชุด Reply ตรวจอัปเดต ต่ออายุโค้ด และออกจากโปรแกรม`, show: img('about') },

  { cover: true, title: 'พร้อมใช้งาน', text: 'กดกากบาท โปรแกรมยังทำงานอยู่ที่มุมขวาล่างของจอ<br>ติดปัญหา แจ้งผู้ดูแล' },
];

function slideHtml(slide, index, mockCss) {
  const progress = Math.round(((index + 1) / SLIDES.length) * 100);
  const body = slide.cover
    ? `<div class="cover"><img src="img/icon.png" width="120" height="120"><h1>${slide.title}</h1><p>${slide.text}</p></div>`
    : `<div class="left"><div class="part">${slide.part}</div><div class="num">${slide.n}</div><p>${slide.text}</p></div><div class="right">${slide.show}</div>`;
  return `<!doctype html><meta charset="utf-8"><base href="${'file:///' + docs.replace(/\\/g, '/')}/"><style>
    :root { --mark: #f59e0b; --line: #e2e5ea; --accent: #2563eb; --accent-bg: #e8effd; --muted: #6b7280; }
    ${mockCss}
    html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #f6f7f9; color: #1f2933; font: 16px/1.5 "Segoe UI", "Leelawadee UI", sans-serif; }
    .stage { display: grid; grid-template-columns: 470px 1fr; gap: 36px; height: ${HEIGHT - 56}px; padding: 44px 48px 0; box-sizing: border-box; align-items: center; }
    .part { display: inline-block; padding: 4px 16px; border-radius: 999px; background: #2563eb; color: #fff; font-size: 20px; font-weight: 600; }
    .num { margin: 22px 0 10px; width: 64px; height: 64px; border-radius: 50%; background: #e8effd; color: #2563eb; font-size: 34px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .left p { margin: 0; font-size: 31px; line-height: 1.5; }
    .left small { font-size: 22px; color: #6b7280; }
    .left b.k, .left b.btn { font-size: 26px; }
    .right { display: flex; align-items: center; justify-content: center; height: 100%; min-width: 0; }
    .right > img { max-width: 100%; max-height: 580px; border: 1px solid #d9dde3; border-radius: 12px; background: #fff; }
    .mockwrap { zoom: 1.55; width: 100%; max-width: 440px; }
    .mockwrap .mock::after { content: ""; }
    .cover { grid-column: 1 / -1; text-align: center; }
    .cover h1 { margin: 18px 0 8px; font-size: 60px; }
    .cover p { margin: 0; font-size: 30px; color: #4b5563; line-height: 1.6; }
    .foot { position: absolute; left: 0; right: 0; bottom: 0; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 48px; font-size: 15px; letter-spacing: 0.14em; color: #6b7280; }
    .bar2 { position: absolute; left: 0; bottom: 0; height: 6px; width: ${progress}%; background: #2563eb; }
  </style><div class="stage">${body}</div><div class="foot"><span>QuickWai by Florentino356</span><span>${index + 1} / ${SLIDES.length}</span></div><div class="bar2"></div>`;
}

const RECORDER = `<!doctype html><meta charset="utf-8"><canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas><script>
  window.record = async (frames, seconds, fadeMs) => {
    const images = await Promise.all(frames.map((src) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.src = src; })));
    const ctx = document.getElementById('c').getContext('2d');
    const stream = document.getElementById('c').captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1.42E01E', videoBitsPerSecond: 1500000 });
    const chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise((resolve) => (recorder.onstop = resolve));
    const total = images.length * seconds * 1000;
    const started = performance.now();
    recorder.start(1000);
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        const t = performance.now() - started;
        if (t >= total) { clearInterval(timer); return resolve(); }
        const index = Math.floor(t / (seconds * 1000));
        const into = t - index * seconds * 1000;
        ctx.globalAlpha = 1;
        ctx.drawImage(images[index], 0, 0);
        // Fade the previous slide out over the first moments of this one.
        if (index > 0 && into < fadeMs) { ctx.globalAlpha = 1 - into / fadeMs; ctx.drawImage(images[index - 1], 0, 0); }
      }, 33);
    });
    recorder.stop();
    await done;
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  };
</script>`;

// The painter window closes before the recorder opens; keep the app alive in between.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const mockCss = /\/\* simplified drawings of other programs \*\/([\s\S]*?)<\/style>/.exec(fs.readFileSync(path.join(docs, 'index.html'), 'utf8'))[1]
    + ' b.k { font: 600 13px Consolas, monospace; padding: 2px 8px; border: 1px solid #e2e5ea; border-radius: 6px; background: #fff; white-space: nowrap; } b.btn { padding: 1px 8px; border-radius: 6px; background: #e8effd; color: #2563eb; font-weight: 600; white-space: nowrap; }';
  const only = process.argv.includes('--preview') ? 4 : SLIDES.length;
  const tmp = path.join(app.getPath('temp'), 'quickwai-video');
  fs.mkdirSync(tmp, { recursive: true });

  const painter = new BrowserWindow({ show: false, width: WIDTH, height: HEIGHT, useContentSize: true, webPreferences: { offscreen: true } });
  const frames = [];
  for (let i = 0; i < only; i++) {
    const file = path.join(tmp, `slide-${i}.html`);
    fs.writeFileSync(file, slideHtml(SLIDES[i], i, mockCss));
    await painter.loadFile(file);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const png = (await painter.webContents.capturePage()).resize({ width: WIDTH, height: HEIGHT }).toPNG();
    fs.writeFileSync(path.join(tmp, `slide-${i}.png`), png);
    frames.push('data:image/png;base64,' + png.toString('base64'));
  }
  painter.destroy();

  const recorderFile = path.join(tmp, 'recorder.html');
  fs.writeFileSync(recorderFile, RECORDER);
  const recorder = new BrowserWindow({ show: false, width: WIDTH, height: HEIGHT, webPreferences: { backgroundThrottling: false } });
  await recorder.loadFile(recorderFile);
  const seconds = process.argv.includes('--preview') ? 2 : SECONDS_PER_SLIDE;
  const bytes = await recorder.webContents.executeJavaScript(`record(${JSON.stringify(frames)}, ${seconds}, ${FADE_MS})`);
  const out = path.join(docs, 'guide', process.argv.includes('--preview') ? 'preview.mp4' : 'QuickWai-guide.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(bytes));
  console.log(`${out} ${(bytes.length / 1024 / 1024).toFixed(1)} MB, ${only} slides, ${only * seconds} s; slide images in ${tmp}`);
  app.quit();
});
