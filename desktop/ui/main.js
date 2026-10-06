const { searchReplies, hotkeyLabel, NAME_FIELD } = QRShared;
const $ = (id) => document.getElementById(id);

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

// Shows the message with {ชื่อ} highlighted.
function textPreview(text) {
  const parts = text.split(NAME_FIELD);
  return parts.flatMap((part, i) => (i < parts.length - 1 ? [part, el('span', { className: 'field', textContent: NAME_FIELD })] : [part]));
}

function renderCategories() {
  $('cats').replaceChildren(
    ...['', ...categories].map((cat) => el('button', {
      className: 'chip' + (cat === category ? ' on' : ''),
      textContent: cat || 'ทั้งหมด',
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
      el('div', { className: 'text' }, ...textPreview(reply.text)));
    if (reply.images.length) {
      body.append(el('div', { className: 'thumbs' }, ...reply.images.map((img) => el('img', { src: fileUrl(img.path), title: img.name }))));
    }
    return el('div', { className: 'card', onclick: () => openEditor(reply) },
      el('kbd', { textContent: reply.hotkey ? hotkeyLabel(reply.hotkey) : 'ไม่มี Hotkey' }), body, star);
  }));
}

let updateLabel = '';

function renderStatus(status) {
  updateLabel = status.updateReady ? `อัปเดต ${status.updateReady} พร้อม เปิดใหม่เพื่อใช้` : `v${status.version}`;
  $('updateBtn').textContent = updateLabel;
  const label = status.extConnected ? 'Extension เชื่อมต่อแล้ว' : 'Extension ไม่ได้เชื่อมต่อ';
  for (const id of ['extStatus', 'guideStatus']) {
    $(id).textContent = '● ' + label;
    $(id).className = 'pill ' + (status.extConnected ? 'ok' : 'warn');
  }
  const notes = [`เปิดเมื่อ ${status.startedAt}`, status.paused ? 'หยุด Hotkey ชั่วคราว' : `ค้นหาด่วน ${hotkeyLabel(status.panelHotkey)}`];
  if (status.extConnected) notes.push(status.name ? `ลูกค้า: ${status.name}` : 'ไม่พบชื่อในโน๊ต');
  if (status.license.ok) {
    const daysLeft = Math.floor((status.license.expiresAt - Date.now()) / 86400000);
    notes.push(`ใช้ได้ถึง ${new Date(status.license.expiresAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })} (เหลือ ${daysLeft} วัน)`, `เครื่อง ${status.machineId}`);
  }
  if (status.serverError) notes.push(status.serverError);
  if (status.failedHotkeys.length) notes.push(`Hotkey ใช้ไม่ได้: ${status.failedHotkeys.map(hotkeyLabel).join(', ')}`);
  $('appStatus').textContent = notes.join(' · ');
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
  hint.textContent = 'ใช้ได้เฉพาะตอนหน้าแชท LINE OA อยู่ด้านหน้า กด Backspace เพื่อลบ';
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

// ---- extension guide -----------------------------------------------------

const openGuide = () => $('guide').showModal();
$('extStatus').onclick = openGuide;
$('guideBtn').onclick = openGuide;
$('quitBtn').onclick = () => qr.quit();
$('updateBtn').onclick = async () => {
  $('updateBtn').textContent = 'กำลังตรวจ...';
  const result = await qr.checkUpdate();
  if (result.status === 'current') alert('ใช้เวอร์ชันล่าสุดอยู่แล้ว');
  if (result.status === 'error') alert(`ตรวจอัปเดตไม่ได้: ${result.message}`);
  if (result.status === 'updated') alert(`อัปเดต ${result.version} พร้อมแล้ว ปิดแล้วเปิดโปรแกรมใหม่เพื่อใช้`);
  $('updateBtn').textContent = updateLabel;
};
$('importBtn').onclick = () => qr.importData();
$('exportBtn').onclick = async () => {
  const done = await qr.exportData();
  if (done) alert(`ส่งออก ${done.count} Reply แล้ว\n${done.file}`);
};
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
