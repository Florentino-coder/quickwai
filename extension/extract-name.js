// Finds the customer name in LINE OA note text: the word after "ชื่อ", or a line that starts with "พี่".
(function (root) {
  const NAME = /ชื่อ(?!\s*(?:บัญชี|ผู้ใช้|ไลน์|ธนาคาร|เฟส|ยูส|line|user|id))(?:\s*[-\/]?\s*(?:นาม)?สกุล)?(?:\s*เล่น)?\s*[:：=\-]?\s*([^\s,;:：\/|()\[\]{}]{1,30})/i;

  // A note line that starts with "พี่", for example "พี่บราวน์". The title stays part of the name.
  const TITLED = /^[ \t]*(พี่[ \t]?[^\s,;:：\/|()\[\]{}]{1,30})/m;

  function extractName(noteText) {
    const text = noteText || '';
    const match = NAME.exec(text);
    if (match) return match[1];
    const titled = TITLED.exec(text);
    return titled ? titled[1].replace(/[ \t]/g, '') : '';
  }

  root.QRExtractName = extractName;
  if (typeof module !== 'undefined') module.exports = { extractName };
})(typeof globalThis !== 'undefined' ? globalThis : this);
