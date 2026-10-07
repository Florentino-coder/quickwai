const $ = (id) => document.getElementById(id);

function set(id, text, ok) {
  $(id).textContent = text;
  $(id).className = ok ? 'ok' : 'bad';
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refresh() {
  const { desktopOk, desktopAt } = await chrome.storage.session.get(['desktopOk', 'desktopAt']);
  const fresh = desktopOk && Date.now() - desktopAt < 5000;
  set('desktop', fresh ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ', fresh);

  const tab = await activeTab();
  let state = null;
  try { state = await chrome.tabs.sendMessage(tab.id, { type: 'debug' }); } catch {}
  if (!state) {
    set('note', 'เปิดหน้า chat.line.biz ก่อน', false);
    set('name', '-', false);
    set('tag', '-', false);
    $('text').textContent = '';
    return;
  }
  set('note', state.noteFound ? 'พบ' : 'ไม่พบ', state.noteFound);
  set('name', state.name || 'ไม่พบชื่อในโน๊ต', !!state.name);
  set('tag', { set: 'ใส่แล้ว', none: 'ยังไม่ใส่', unknown: 'ไม่ทราบ' }[state.tag], state.tag === 'set');
  $('text').textContent = state.noteText || (state.selector ? 'ตำแหน่งที่เลือกไม่มีข้อความ' : '');
}

chrome.storage.local.get('overlayOn', (saved) => { $('overlayOn').checked = saved.overlayOn !== false; });
$('overlayOn').onchange = (event) => chrome.storage.local.set({ overlayOn: event.target.checked });

$('pick').onclick = async () => {
  const tab = await activeTab();
  try { await chrome.tabs.sendMessage(tab.id, { type: 'pick' }); } catch {}
  window.close();
};

$('reset').onclick = async () => {
  await chrome.storage.local.remove('noteSelector');
  refresh();
};

refresh();
setInterval(refresh, 1000);
