const DESKTOP = 'http://127.0.0.1:38457';
const CONTENT_SCRIPTS = ['extract-name.js', 'overlay.js', 'content.js'];

function isNewer(a, b) {
  const left = String(a).split('.').map(Number);
  const right = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff) return diff > 0;
  }
  return false;
}

// The desktop app copies new extension files into this folder, then reports their version.
// Reloading makes Chrome read them. Each version is tried once, so a failed copy cannot loop.
async function reloadIfUpdated(diskVersion) {
  if (!diskVersion || !isNewer(diskVersion, chrome.runtime.getManifest().version)) return;
  const { reloadTried } = await chrome.storage.local.get('reloadTried');
  if (reloadTried === diskVersion) return;
  await chrome.storage.local.set({ reloadTried: diskVersion });
  chrome.runtime.reload();
}

const post = (path, body) => fetch(DESKTOP + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-QuickReply': '1' },
  body: JSON.stringify(body),
});

// The desktop app cannot call the extension. One request stays open, and the app answers it
// when it has a command. The loop ends when the app is away; the next state message starts it again.
let polling = false;
async function pollCommands() {
  if (polling) return;
  polling = true;
  try {
    for (;;) {
      const res = await post('/wait', {});
      if (!res.ok) break;
      const command = await res.json();
      if (command.type !== 'focusInput') continue;
      const ok = await chrome.tabs.sendMessage(command.tabId, { type: 'focusInput' }).then((reply) => !!reply?.ok, () => false);
      post('/ack', { n: command.n, ok }).catch(() => {});
    }
  } catch {}
  polling = false;
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'state' || !sender.tab) return;
  pollCommands();
  post('/state', { ...msg.state, tabId: sender.tab.id, incognito: sender.tab.incognito })
    .then(async (res) => {
      if (res.ok) reloadIfUpdated((await res.json().catch(() => ({}))).extensionVersion);
      return res.ok;
    }, () => false)
    .then((ok) => chrome.storage.session.set({ desktopOk: ok, desktopAt: Date.now() }));
});

// After an install or reload, open chat tabs still hold the old content script. Start the new one there.
chrome.runtime.onInstalled.addListener(async () => {
  for (const tab of await chrome.tabs.query({ url: 'https://chat.line.biz/*' })) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_SCRIPTS }).catch(() => {});
  }
});
