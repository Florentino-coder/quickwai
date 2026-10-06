const { searchReplies, hotkeyLabel, NAME_FIELD } = QRShared;
const $ = (id) => document.getElementById(id);
const DAY_MS = 86400000;
const HOTKEY_HINT = 'ใช้ได้เฉพาะตอนหน้าแชท LINE OA อยู่ด้านหน้า กด Backspace เพื่อลบ';

let replies = [];
let categories = [];
let category = '';
let draft = null;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const fileUrl = (filePath) => 'file:///' + encodeURI(filePath.replace(/\\/g, '/'));

function pill(id, text, tone) {
  $(id).textContent = text;
  $(id).className = 'pill ' + tone;
  $(id).hidden = !text;
}

// Shows the message with {ชื่อ} highlighted.
function textPreview(text) {
  const parts = text.split(NAME_FIELD);
  return parts.flatMap((part, i) => (i < parts.length - 1 ? [part, el('span', { className: 'field', textContent: NAME_FIELD })] : [part]));
}

function renderCategories() {
  const count = (cat) => replies.filter((r) => !cat || r.category === cat).length;
  $('cats').replaceChildren(
    ...['', ...categories].filter((cat) => !cat || count(cat) || cat === category).map((cat) => el('button', {
      className: 'chip' + (cat === category ? ' on' : ''),
      textContent: `${cat || 'ทั้งหมด'} ${count(cat)}`,
      onclick: () => { category = cat; render(); },
    })));
}

function render() {
  renderCategories();
  const found = searchReplies(replies, $('q').value, category);
  if (!found.length) {
    $('list').replaceChildren(el('div', { className: 'empty', textContent: replies.length ? 'ไม่พบ Reply ที่ค้นหา' : 'ยังไม่มี Reply กด "เพิ่ม Reply" เพื่อสร้างอันแรก' }));
    return;
  }
  $('list').replaceChildren(...found.map((reply) => {
    const star = el('button', {
      className: 'star' + (reply.favorite ? ' on' : ''),
      textContent: reply.favorite ? '★' : '☆',
      title: 'รายการโปรด',
      onclick: (event) => { event.stopPropagation(); qr.saveReply({ ...reply, favorite: !reply.favorite }); },
    });
    const body = el('div', { className: 'body' },
      el('div', { className: 'name', textContent: reply.name }),
      el('div', { className: 'text' }, ...(reply.text ? textPreview(reply.text) : ['ไม่มีข้อความ'])));
    if (reply.images.length) {
      body.append(el('div', { className: 'thumbs' }, ...reply.images.map((img) => el('img', { src: fileUrl(img.path), title: img.name }))));
    }
    const meta = [reply.category, reply.images.length ? `${reply.images.length} รูป` : '', reply.usageCount ? `ใช้ ${reply.usageCount} ครั้ง` : ''].filter(Boolean).join(' · ');
    body.append(el('div', { className: 'meta', textContent: meta }));
    return el('div', { className: 'card', onclick: () => openEditor(reply) },
      el('kbd', { className: reply.hotkey ? '' : 'none', textContent: reply.hotkey ? hotkeyLabel(reply.hotkey) : 'ไม่มี Hotkey' }), body, star);
  }));
}

function renderStatus(status) {
  const extLabel = status.extConnected ? 'Extension เชื่อมต่อแล้ว' : 'Extension ไม่ได้เชื่อมต่อ';
  pill('extStatus', '● ' + extLabel, status.extConnected ? 'ok' : 'warn');
  pill('guideStatus', '● ' + extLabel, status.extConnected ? 'ok' : 'warn');
  const customer = !status.extConnected ? '' : status.name ? `ลูกค้า: ${status.name}` : status.noteFound ? 'ไม่พบชื่อในโน๊ต' : 'ไม่พบแถบโน้ต';
  pill('customer', customer, status.name ? 'info' : 'warn');

  $('panelKey').textContent = status.paused ? 'หยุดชั่วคราว' : hotkeyLabel(status.panelHotkey);

  const notices = [];
  if (status.updateReady) notices.push(`อัปเดต ${status.updateReady} พร้อมแล้ว ปิดแล้วเปิดโปรแกรมใหม่เพื่อใช้`);
  if (status.serverError) notices.push(status.serverError);
  if (status.failedHotkeys.length) notices.push(`Hotkey ใช้ไม่ได้: ${status.failedHotkeys.map(hotkeyLabel).join(', ')}`);
  $('notice').textContent = notices.join(' · ');

  const expiry = status.license.ok ? new Date(status.license.expiresAt).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-';
  const daysLeft = status.license.ok ? Math.floor((status.license.expiresAt - Date.now()) / DAY_MS) : 0;
  const expiring = status.license.ok && daysLeft <= status.expiryWarnDays;
  pill('licenseNote', status.license.ok ? `ใช้ได้อีก ${daysLeft} วัน` : '', expiring ? 'warn' : 'plain');
  $('expiryBar').hidden = !expiring;
  $('expiryText').textContent = `โค้ดใช้งานจะหมด${daysLeft > 0 ? `ในอีก ${daysLeft} วัน` : 'วันนี้'} ส่งรหัสเครื่อง ${status.machineId} ให้ผู้ดูแลเพื่อต่ออายุ`;
  $('startWithWindows').checked = status.startWithWindows;
  $('startNote').textContent = status.installed ? 'เปิดเองตอนเข้า Windows และอยู่ใน Tray' : 'มีผลเมื่อติดตั้งจากไฟล์ Setup';

  $('aboutUser').textContent = status.license.name || '-';
  $('aboutExpiry').textContent = status.license.ok ? `${expiry} (เหลือ ${daysLeft} วัน)` : '-';
  $('aboutMachine').textContent = status.machineId;
  $('aboutVersion').textContent = status.version;
  $('aboutExt').textContent = extLabel.replace('Extension ', '');
  $('aboutStarted').textContent = status.startedAt;
}

// ---- editor --------------------------------------------------------------

function openEditor(reply) {
  draft = reply
    ? { ...reply, images: [...reply.images] }
    : { name: '', category: category || categories[0], hotkey: '', text: '', favorite: false, images: [] };
  $('editorTitle').textContent = reply ? 'แก้ไข Reply' : 'เพิ่ม Reply';
  $('name').value = draft.name;
  $('category').replaceChildren(...categories.map((cat) => el('option', { value: cat, textContent: cat })));
  $('category').value = draft.category;
  $('hotkey').value = hotkeyLabel(draft.hotkey);
  $('hotkeyHint').textContent = HOTKEY_HINT;
  $('text').value = draft.text;
  $('delete').hidden = !reply;
  renderDraftImages();
  $('editor').showModal();
}

function renderDraftImages() {
  $('images').replaceChildren(
    ...draft.images.map((img) => el('div', { className: 'thumb' },
      el('img', { src: fileUrl(img.path), title: img.name }),
      el('button', { textContent: '×', title: 'เอารูปออก', onclick: () => { draft.images = draft.images.filter((i) => i.id !== img.id); renderDraftImages(); } }))),
    el('button', { textContent: '+ เพิ่มรูป', onclick: async () => { draft.images.push(...await qr.addImages()); renderDraftImages(); } }));
}

function acceleratorFrom(event) {
  const code = event.code;
  let key = '';
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^F([1-9]|1[0-2])$/.test(code)) key = code;
  else if (/^Arrow/.test(code)) key = code.slice(5);
  if (!key) return null;
  const mods = [event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Super'].filter(Boolean);
  return { accelerator: [...mods, key].join('+'), key, mods };
}

$('hotkey').addEventListener('keydown', (event) => {
  if (event.key === 'Tab') return;
  event.preventDefault();
  if (event.key === 'Backspace' || event.key === 'Delete') {
    draft.hotkey = '';
    $('hotkey').value = '';
    return;
  }
  const pressed = acceleratorFrom(event);
  if (!pressed) return;
  const hint = $('hotkeyHint');
  const isFKey = pressed.key.startsWith('F') && pressed.key.length > 1;
  if (pressed.key === 'F12' && !pressed.mods.length) return void (hint.textContent = 'F12 ใช้ไม่ได้ Windows สงวนไว้ เลือกปุ่มอื่น');
  if (!isFKey && !pressed.mods.some((m) => m !== 'Shift')) return void (hint.textContent = 'กดร่วมกับ Ctrl หรือ Alt เช่น Alt + 1');
  hint.textContent = HOTKEY_HINT;
  draft.hotkey = pressed.accelerator;
  $('hotkey').value = hotkeyLabel(pressed.accelerator);
});

$('insertName').onclick = () => {
  const box = $('text');
  box.setRangeText(NAME_FIELD, box.selectionStart, box.selectionEnd, 'end');
  box.focus();
};

$('save').onclick = async () => {
  draft.name = $('name').value.trim();
  draft.category = $('category').value;
  draft.text = $('text').value;
  if (!draft.name) return $('name').focus();
  if (draft.hotkey === 'Control+Space') return void ($('hotkeyHint').textContent = 'Ctrl + Space ใช้เปิดค้นหาด่วนอยู่แล้ว เลือกปุ่มอื่น');
  const clash = replies.find((r) => r.id !== draft.id && r.hotkey && r.hotkey === draft.hotkey);
  if (clash && !confirm(`${hotkeyLabel(draft.hotkey)} ใช้อยู่กับ "${clash.name}"\n\nกด OK เพื่อย้าย Hotkey มาที่ Reply นี้`)) return;
  await qr.saveReply(draft);
  $('editor').close();
};

$('delete').onclick = async () => {
  if (!confirm(`ลบ "${draft.name}" ใช่ไหม`)) return;
  await qr.deleteReply(draft.id);
  $('editor').close();
};

$('cancel').onclick = () => $('editor').close();
$('add').onclick = () => openEditor(null);
$('q').oninput = render;

// ---- settings and info ---------------------------------------------------

$('aboutBtn').onclick = () => $('about').showModal();
$('licenseNote').onclick = () => $('about').showModal();
$('closeAbout').onclick = () => $('about').close();
$('copyMachine').onclick = () => qr.copy($('aboutMachine').textContent);
$('expiryCopy').onclick = () => qr.copy($('aboutMachine').textContent);
$('expiryRenew').onclick = () => qr.openLicense();
$('renewBtn').onclick = () => qr.openLicense();
$('startWithWindows').onchange = (event) => qr.setSettings({ startWithWindows: event.target.checked });
$('openData').onclick = () => qr.openDataFolder();
$('importBtn').onclick = () => qr.importData();
$('quitBtn').onclick = () => qr.quit();

$('exportBtn').onclick = async () => {
  const done = await qr.exportData();
  if (done) alert(`ส่งออก ${done.count} Reply แล้ว\n${done.file}`);
};

$('updateBtn').onclick = async () => {
  $('updateBtn').textContent = 'กำลังตรวจ...';
  const result = await qr.checkUpdate();
  $('updateBtn').textContent = 'ตรวจอัปเดต';
  if (result.status === 'current') alert('ใช้เวอร์ชันล่าสุดอยู่แล้ว');
  if (result.status === 'error') alert(`ตรวจอัปเดตไม่ได้: ${result.message}`);
  if (result.status === 'updated') alert(`อัปเดต ${result.version} พร้อมแล้ว ปิดแล้วเปิดโปรแกรมใหม่เพื่อใช้`);
};

// ---- extension guide -----------------------------------------------------

const openGuide = () => $('guide').showModal();
$('extStatus').onclick = openGuide;
$('guideBtn').onclick = openGuide;
$('closeGuide').onclick = () => $('guide').close();
$('copyUrl').onclick = () => qr.copy('chrome://extensions');
$('copyDir').onclick = () => qr.copy($('extDir').textContent);
$('openDir').onclick = () => qr.openExtensionFolder();

qr.onData((data) => { replies = data.replies; categories = data.categories; render(); });
qr.onStatus(renderStatus);
qr.init().then((data) => {
  replies = data.replies;
  categories = data.categories;
  $('extDir').textContent = data.extensionDir;
  render();
  renderStatus(data.status);
});
