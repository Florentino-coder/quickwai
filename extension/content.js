(() => {
  const NOTE_HEADING = /^(โน้ต|โน๊ต|notes?|memo|ノート)(\s*\d+\s*\/\s*\d+)?$/i;
  const NOTE_MARKED = '[class*="note" i],[class*="memo" i],[data-testid*="note" i],[aria-label*="note" i],[aria-label*="โน้ต"]';
  const MAX_NOTE_CHARS = 3000;
  // LINE shows this link only while the chat has no tag.
  const TAG_EMPTY = /^\+?\s*(ใส่แท็ก|add tags?)$/i;
  const CHAT_URL = /\/chat\/[^/]+/;
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

  // The boxes around a heading that reads "โน้ต" (or "Notes", "โน้ต 1/1"), smallest first.
  // The first box may hold only the heading and its counter, so the wider ones are kept too.
  function fromHeadings() {
    const texts = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,button,label,a')) {
      if (el.children.length || !NOTE_HEADING.test(el.textContent.trim())) continue;
      let box = el;
      for (let i = 0; i < 5 && box.parentElement; i++) {
        box = box.parentElement;
        const text = box.innerText || '';
        if (text.length >= MAX_NOTE_CHARS) break;
        if (text.length > el.textContent.length + 2) texts.push(text);
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

  // True when the page shows the "+ ใส่แท็ก" link, which means the chat has no tag yet.
  function tagLinkShown() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (TAG_EMPTY.test(node.nodeValue.trim()) && node.parentElement.offsetParent !== null) return true;
    }
    return false;
  }

  function readState() {
    const text = noteText();
    const noTag = tagLinkShown();
    return {
      url: location.pathname,
      chatOpen: CHAT_URL.test(location.pathname) || text !== null || noTag,
      tag: noTag ? 'none' : text !== null ? 'set' : 'unknown',
      noteFound: text !== null,
      name: text ? QRExtractName(text) : '',
      focused: document.hasFocus(),
      noteText: text,
    };
  }

  function send() {
    const { noteText: _omit, ...state } = readState();
    QROverlay.render(state);
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

  // ---- chat box ----------------------------------------------------------

  const EDITABLE = 'textarea,textarea-ex,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"]';
  const SEND_HINT = /enter|ส่ง|send|送信/i;
  let lastChatBox = null;

  const shown = (el) => el.isConnected && el.offsetParent !== null && !el.closest(NOTE_MARKED) && !el.disabled && !el.readOnly;
  const hintOf = (el) => [el.getAttribute('placeholder'), el.getAttribute('data-placeholder'), el.getAttribute('aria-label')].join(' ');

  // The box where the user types the chat message. LINE can change its page at any time, so three ways back each other up:
  // a box whose hint names the Enter key, the box the user last typed a chat message in, then the widest box at the bottom.
  function chatBox() {
    const boxes = [...document.querySelectorAll(EDITABLE)].filter(shown);
    const hinted = boxes.find((el) => SEND_HINT.test(hintOf(el)));
    if (hinted) return hinted;
    if (lastChatBox && shown(lastChatBox)) return lastChatBox;
    const wide = boxes.map((el) => ({ el, rect: el.getBoundingClientRect() })).filter(({ rect }) => rect.width > 200);
    wide.sort((a, b) => b.rect.bottom - a.rect.bottom);
    return wide[0] ? wide[0].el : null;
  }

  // Remember the box that sends on Enter: the user pressed Enter in it and it emptied.
  addEventListener('keydown', (event) => {
    const el = event.target;
    if (event.key !== 'Enter' || event.shiftKey || !el.matches?.(EDITABLE) || el.closest(NOTE_MARKED)) return;
    setTimeout(() => { if (!(el.value ?? el.textContent ?? '').trim()) lastChatBox = el; }, 300);
  }, true);

  // Puts the text cursor in the chat box, at the end of what is already typed there.
  function focusChatBox() {
    const el = chatBox();
    if (!el) return false;
    if (document.activeElement !== el) {
      el.focus();
      if (el.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      } else if (typeof el.value === 'string') {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
    return document.activeElement === el;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'focusInput') sendResponse({ ok: focusChatBox() });
    if (msg?.type === 'pick') pickNoteArea();
    if (msg?.type === 'debug') {
      const state = readState();
      const box = chatBox();
      sendResponse({ ...state, noteText: (state.noteText || '').slice(0, 300), selector, chatBox: box ? cssPath(box) : '' });
    }
  });

  const observer = new MutationObserver(sendSoon);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  addEventListener('focus', send);
  addEventListener('blur', send);
  timer = setInterval(send, 1000);
  send();
})();
