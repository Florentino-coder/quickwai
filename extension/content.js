(() => {
  const NOTE_HEADING = /^(โน้ต|โน๊ต|notes?|memo|ノート)(\s*\d+\s*\/\s*\d+)?$/i;
  const NOTE_MARKED = '[class*="note" i],[class*="memo" i],[data-testid*="note" i],[aria-label*="note" i],[aria-label*="โน้ต"]';
  const MAX_NOTE_CHARS = 3000;
  let selector = null;
  let timer = null;
  let debounce = null;

  chrome.storage.local.get('noteSelector', (v) => { selector = v.noteSelector || null; });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.noteSelector) selector = changes.noteSelector.newValue || null;
  });

  // The place the user picked by hand in the popup.
  function fromPickedPlace() {
    if (!selector) return [];
    const found = [...document.querySelectorAll(selector)];
    return found.length ? [found.map((el) => el.innerText).join('\n')] : [];
  }

  // The box around a heading that reads "โน้ต" (or "Notes", "โน้ต 1/1").
  function fromHeadings() {
    const texts = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,button,label,a')) {
      if (el.children.length || !NOTE_HEADING.test(el.textContent.trim())) continue;
      let box = el;
      for (let i = 0; i < 5 && box.parentElement; i++) {
        box = box.parentElement;
        const text = box.innerText || '';
        if (text.length <= el.textContent.length + 2) continue;
        if (text.length < MAX_NOTE_CHARS) texts.push(text);
        break;
      }
    }
    return texts;
  }

  // Elements whose class or label names them as a note.
  function fromMarkedElements() {
    return [...document.querySelectorAll(NOTE_MARKED)]
      .map((el) => (el.innerText || '').trim())
      .filter((text) => text.length > 4 && text.length < MAX_NOTE_CHARS);
  }

  // Returns the note panel text, or null when the panel is not on the page.
  // LINE can change its page at any time, so several ways of finding the panel back each other up.
  // A place that holds a name wins over one that does not.
  function noteText() {
    const places = [...fromPickedPlace(), ...fromHeadings(), ...fromMarkedElements()];
    return places.find((text) => QRExtractName(text)) ?? places[0] ?? null;
  }

  function readState() {
    const text = noteText();
    return {
      url: location.pathname,
      noteFound: text !== null,
      name: text ? QRExtractName(text) : '',
      focused: document.hasFocus(),
      noteText: text,
    };
  }

  function send() {
    const { noteText: _omit, ...state } = readState();
    try {
      chrome.runtime.sendMessage({ type: 'state', state }).catch(() => {});
    } catch {
      // Extension was reloaded; this copy of the script is dead.
      clearInterval(timer);
      observer.disconnect();
    }
  }

  function sendSoon() {
    clearTimeout(debounce);
    debounce = setTimeout(send, 300);
  }

  function cssPath(el) {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.body && parts.length < 5; n = n.parentElement) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      const classes = [...n.classList].slice(0, 3).map((c) => '.' + CSS.escape(c)).join('');
      parts.unshift(n.tagName.toLowerCase() + classes);
    }
    return parts.join(' > ');
  }

  function pickNoteArea() {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #06c755;background:rgba(6,199,85,.12)';
    document.documentElement.append(box);
    let current = null;
    const move = (e) => {
      current = e.target;
      const r = current.getBoundingClientRect();
      Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    };
    const stop = () => {
      removeEventListener('mousemove', move, true);
      removeEventListener('click', click, true);
      removeEventListener('keydown', key, true);
      box.remove();
    };
    const click = (e) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
      chrome.storage.local.set({ noteSelector: cssPath(current || e.target) });
    };
    const key = (e) => { if (e.key === 'Escape') stop(); };
    addEventListener('mousemove', move, true);
    addEventListener('click', click, true);
    addEventListener('keydown', key, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'pick') pickNoteArea();
    if (msg?.type === 'debug') {
      const state = readState();
      sendResponse({ ...state, noteText: (state.noteText || '').slice(0, 300), selector });
    }
  });

  const observer = new MutationObserver(sendSoon);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  addEventListener('focus', send);
  addEventListener('blur', send);
  timer = setInterval(send, 1000);
  send();
})();
