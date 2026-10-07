// Floating status badge on the LINE OA chat page.
// It answers two questions before the admin replies: is the customer's name in a note, and is a tag set.
(function (root) {
  const TONES = {
    bad: { fill: '#fdecec', line: '#d93025', text: '#8c1d18' },
    warn: { fill: '#fff4d6', line: '#e6a100', text: '#7a4b00' },
    ok: { fill: '#e3f6ea', line: '#34a853', text: '#0a6b32' },
  };

  let host = null;
  let box = null;
  let enabled = true;
  let position = null;

  chrome.storage.local.get(['overlayOn', 'overlayPosition'], (saved) => {
    enabled = saved.overlayOn !== false;
    position = saved.overlayPosition || null;
    place();
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.overlayOn) enabled = changes.overlayOn.newValue !== false;
    if (changes.overlayPosition) position = changes.overlayPosition.newValue || null;
    place();
  });

  function el(tag, text, style) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
  }

  function place() {
    if (!host) return;
    const left = position ? Math.min(Math.max(position.left, 0), innerWidth - 80) : null;
    const top = position ? Math.min(Math.max(position.top, 0), innerHeight - 40) : 132;
    host.style.cssText = `position:fixed;z-index:2147483646;top:${top}px;` + (left === null ? 'right:330px;' : `left:${left}px;`);
  }

  function enableDrag() {
    box.addEventListener('mousedown', (down) => {
      const start = host.getBoundingClientRect();
      const move = (event) => {
        position = { left: start.left + event.clientX - down.clientX, top: start.top + event.clientY - down.clientY };
        place();
      };
      const up = () => {
        removeEventListener('mousemove', move, true);
        removeEventListener('mouseup', up, true);
        if (position) chrome.storage.local.set({ overlayPosition: position });
      };
      addEventListener('mousemove', move, true);
      addEventListener('mouseup', up, true);
      down.preventDefault();
    });
  }

  function ensure() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'quickwai-overlay';
    box = document.createElement('div');
    box.title = 'ลากเพื่อย้าย ปิดป้ายได้ที่ไอคอน QuickWai บนแถบ Chrome';
    host.attachShadow({ mode: 'open' }).append(box);
    document.documentElement.append(host);
    enableDrag();
    place();
  }

  // state: { chatOpen, noteFound, name, tag } where tag is 'set', 'none' or 'unknown'.
  function render(state) {
    if (!enabled || !state.chatOpen) {
      if (host) host.style.display = 'none';
      return;
    }
    ensure();
    place();

    const panelMissing = !state.noteFound && state.tag !== 'none';
    const tagMissing = state.tag === 'none';
    const tone = TONES[panelMissing || !state.name ? 'bad' : tagMissing ? 'warn' : 'ok'];
    const base = `font:13px/1.5 "Segoe UI","Leelawadee UI",sans-serif;cursor:move;user-select:none;background:${tone.fill};color:${tone.text};box-shadow:0 2px 10px rgba(0,0,0,.18);`;

    if (!panelMissing && state.name && !tagMissing) {
      box.style.cssText = base + `border:1px solid ${tone.line};border-radius:999px;padding:4px 14px;white-space:nowrap;`;
      box.replaceChildren(el('span', `✓ QuickWai: ${state.name} · มีแท็ก`));
      return;
    }

    box.style.cssText = base + `border:2px solid ${tone.line};border-radius:12px;padding:10px 14px;min-width:210px;`;
    if (panelMissing) {
      box.replaceChildren(
        el('div', 'QuickWai: ไม่พบแถบโน้ต', 'font-weight:600;font-size:14px'),
        el('div', 'เปิดแถบข้อมูลลูกค้าด้านขวาของแชท'));
      return;
    }
    const missing = [!state.name && 'โน้ตชื่อ', tagMissing && 'แท็ก'].filter(Boolean);
    box.replaceChildren(
      el('div', `QuickWai: ยังไม่มี${missing.join(' และ ')}`, 'font-weight:600;font-size:14px;margin-bottom:2px'),
      el('div', state.name ? `✓ โน้ตชื่อลูกค้า: ${state.name}` : '✗ โน้ตชื่อลูกค้า: ยังไม่มี'),
      el('div', tagMissing ? '✗ แท็ก: ยังไม่ใส่' : '✓ แท็ก: ใส่แล้ว'));
  }

  root.QROverlay = { render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
