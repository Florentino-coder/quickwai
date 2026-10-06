const DESKTOP_URL = 'http://127.0.0.1:38457/state';
const CONTENT_SCRIPTS = ['extract-name.js', 'content.js'];

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

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'state' || !sender.tab) return;
  fetch(DESKTOP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-QuickReply': '1' },
    body: JSON.stringify({ ...msg.state, tabId: sender.tab.id, incognito: sender.tab.incognito }),
  })
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
