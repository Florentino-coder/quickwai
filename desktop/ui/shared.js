// Shared by the main window, the panel and the main process.
(function (root) {
  const NAME_FIELD = '{ชื่อ}';

  // Thai Kedmanee layout, so a search typed with the wrong layout still matches ("/kd" finds "ฝาก").
  const EN = [..."1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?"];
  const TH = [..."ๅ/-ภถุึคตจขชๆไำพะัีรนยบลฃฟหกดเ้่าสวงผปแอิืทมใฝ๐\"ฎฑธํ๊ณฯญฐ,ฤฆฏโฌ็๋ษศซ.()ฉฮฺ์?ฒฬฦ"];
  const toThaiMap = new Map(EN.map((ch, i) => [ch, TH[i]]));

  function toThaiLayout(text) {
    return [...text].map((ch) => toThaiMap.get(ch) ?? ch).join('');
  }

  function searchReplies(replies, query, category) {
    const q = (query || '').trim();
    const needles = q ? [q.toLowerCase(), toThaiLayout(q).toLowerCase()] : [];
    return replies
      .filter((r) => !category || r.category === category)
      .filter((r) => {
        if (!needles.length) return true;
        const hay = [r.name, r.text, r.category, r.hotkey].join('\n').toLowerCase();
        return needles.some((n) => hay.includes(n));
      })
      .sort((a, b) =>
        (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) ||
        (b.lastUsedAt || 0) - (a.lastUsedAt || 0) ||
        a.name.localeCompare(b.name, 'th'));
  }

  function needsName(text) {
    return (text || '').includes(NAME_FIELD);
  }

  // Without a name, "คุณ {ชื่อ}" is removed so the sentence still reads well.
  function fillName(text, name) {
    if (name) return text.replaceAll(NAME_FIELD, name);
    return text
      .replace(/(คุณ)?[ \t]*\{ชื่อ\}[ \t]*/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .split('\n').map((line) => line.trim()).join('\n');
  }

  function hotkeyLabel(accelerator) {
    return (accelerator || '').replace('Control', 'Ctrl').replace('Super', 'Win').split('+').join(' + ');
  }

  const api = { NAME_FIELD, EN, TH, toThaiLayout, searchReplies, needsName, fillName, hotkeyLabel };
  root.QRShared = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
