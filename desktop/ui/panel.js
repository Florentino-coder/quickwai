const { searchReplies, fillName, hotkeyLabel } = QRShared;
const $ = (id) => document.getElementById(id);

let replies = [];
let found = [];
let index = 0;
let setIndex = 0;
let step = 'list';
let chosen = null;
let chosenSet = null;
let name = '';

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const fileUrl = (filePath) => 'file:///' + encodeURI(filePath.replace(/\\/g, '/'));

const HINTS = {
  list: 'Enter วาง · Shift + Enter เลือกรูป · Ctrl + 1-9 เลือกเลย · Esc ปิด',
  set: 'ลูกศรขึ้นลง เลือก · Enter หรือ Tab วาง · เลข 1-9 วางเลย · Esc ปิด',
  image: 'กดเลข 1-9 เลือกหรือเอาออก · Enter วาง · Esc ยกเลิก',
};

function show(next) {
  step = next;
  $('pq').hidden = $('plist').hidden = next !== 'list';
  $('setStep').hidden = next !== 'set';
  $('imageStep').hidden = next !== 'image';
  $('hint').textContent = HINTS[next];
}

function renderBanner(status) {
  const banner = $('banner');
  if (!status.extConnected) {
    banner.className = 'banner off';
    banner.textContent = 'Extension ไม่ได้เชื่อมต่อ ข้อความจะไม่มีชื่อลูกค้า';
  } else if (status.name) {
    banner.className = status.tag === 'none' ? 'banner warn' : 'banner ok';
    banner.textContent = `ลูกค้า: ${status.name}` + (status.tag === 'none' ? ' · ยังไม่ใส่แท็ก' : '');
  } else {
    banner.className = 'banner warn';
    banner.textContent = (status.noteFound ? 'ไม่พบชื่อในโน๊ต' : 'ไม่พบแถบโน้ต เปิดแถบโน้ตด้านข้างของแชท') + (status.tag === 'none' ? ' · ยังไม่ใส่แท็ก' : '');
  }
}

function renderList() {
  found = searchReplies(replies, $('pq').value, '');
  index = Math.min(index, Math.max(found.length - 1, 0));
  if (!found.length) {
    $('plist').replaceChildren(el('div', { className: 'item muted', textContent: 'ไม่พบ Reply' }));
    return;
  }
  $('plist').replaceChildren(...found.map((reply, i) => el('div', {
    className: 'item' + (i === index ? ' on' : ''),
    onclick: (event) => choose(reply, event.shiftKey),
  },
    el('kbd', { textContent: i < 9 ? `Ctrl ${i + 1}` : '' , hidden: i >= 9 }),
    el('span', { className: 'name', textContent: reply.name }),
    el('span', { className: 'muted', textContent: [reply.sets.length > 1 ? `${reply.sets.length} ชุด` : reply.images.length ? `${reply.images.length} รูป` : '', hotkeyLabel(reply.hotkey)].filter(Boolean).join(' · ') }))));
  $('plist').querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}

function choose(reply, withImagePick) {
  chosen = reply;
  if (reply.sets.length === 1) return chooseSet(reply.sets[0], withImagePick);
  setIndex = 0;
  $('setTitle').textContent = reply.name;
  $('pq').blur();
  show('set');
  renderSets();
}

// The order of the sets never changes, so each number key always pastes the same set.
function renderSets() {
  $('setList').replaceChildren(...chosen.sets.map((set, i) => el('div', {
    className: 'item' + (i === setIndex ? ' on' : ''),
    onclick: (event) => chooseSet(set, event.shiftKey),
  },
    el('kbd', { textContent: String(i + 1), hidden: i >= 9 }),
    el('span', { className: 'name', textContent: fillName(set.text, name).trim().split('\n')[0] || 'ไม่มีข้อความ' }),
    el('span', { className: 'muted', textContent: set.images.length ? `${set.images.length} รูป` : '' }))));
  $('setList').querySelector('.on')?.scrollIntoView({ block: 'nearest' });

  const current = chosen.sets[setIndex];
  $('setPreview').replaceChildren(
    el('div', { className: 'ptext', textContent: fillName(current.text, name).trim() || 'ไม่มีข้อความ' }),
    el('div', { className: 'thumbs' }, ...current.images.map((img) => el('img', { src: fileUrl(img.path), title: img.name }))));
}

function chooseSet(set, withImagePick) {
  chosenSet = set;
  if (!(withImagePick && set.images.length > 1)) return finish(null);
  $('imageTitle').textContent = `${chosen.name}: เลือกรูปที่จะใช้`;
  $('imagePick').replaceChildren(...set.images.map((img) => el('label', { title: img.name },
    el('input', { type: 'checkbox', checked: true, value: img.id }),
    el('img', { src: fileUrl(img.path) }))));
  show('image');
}

function finish(imageIds) {
  qr.useReply({ id: chosen.id, setId: chosenSet.id, name, imageIds });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') return qr.hidePanel();

  if (step === 'image') {
    const boxes = [...$('imagePick').querySelectorAll('input')];
    const digit = /^Digit([1-9])$/.exec(event.code);
    if (digit && boxes[digit[1] - 1]) boxes[digit[1] - 1].checked = !boxes[digit[1] - 1].checked;
    if (event.key === 'Enter') finish(boxes.filter((box) => box.checked).map((box) => box.value));
    return;
  }

  if (step === 'set') {
    const sets = chosen.sets;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    event.preventDefault();
    if (digit && sets[digit[1] - 1]) chooseSet(sets[digit[1] - 1], false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      setIndex = (setIndex + (event.key === 'ArrowDown' ? 1 : -1) + sets.length) % sets.length;
      renderSets();
    } else if (event.key === 'Enter' || event.key === 'Tab') chooseSet(sets[setIndex], event.shiftKey);
    return;
  }

  // Ctrl is required: on the Thai layout the plain digit keys type letters used in searches.
  const digit = /^Digit([1-9])$/.exec(event.code);
  if (event.ctrlKey && digit) {
    event.preventDefault();
    if (found[digit[1] - 1]) choose(found[digit[1] - 1], event.shiftKey);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    index = (index + (event.key === 'ArrowDown' ? 1 : -1) + found.length) % Math.max(found.length, 1);
    renderList();
  } else if (event.key === 'Enter' && found[index]) {
    choose(found[index], event.shiftKey);
  }
});

$('pq').oninput = () => { index = 0; renderList(); };

qr.onPanelOpen(({ status, replies: list, pickFor }) => {
  replies = list;
  name = status.name;
  index = 0;
  $('pq').value = '';
  renderBanner(status);
  show('list');
  renderList();
  $('pq').focus();
  const direct = pickFor && replies.find((r) => r.id === pickFor);
  if (direct) choose(direct, false);
});
