const DESKTOP_URL = 'http://127.0.0.1:38457/state';

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'state' || !sender.tab) return;
  fetch(DESKTOP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-QuickReply': '1' },
    body: JSON.stringify({ ...msg.state, tabId: sender.tab.id, incognito: sender.tab.incognito }),
  })
    .then((res) => res.ok, () => false)
    .then((ok) => chrome.storage.session.set({ desktopOk: ok, desktopAt: Date.now() }));
});
