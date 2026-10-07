// Finds the name staff call the customer by in LINE OA note text.
// A line that starts with a title ("พี่น้ำ") wins; otherwise the word after "ชื่อ".
// "ชื่อ - นามสกุล" is the legal name on the bank account, so it never counts.
(function (root) {
  const NAME = /ชื่อ(?!\s*(?:[-\/]?\s*(?:นาม)?สกุล|บัญชี|ผู้ใช้|ไลน์|ธนาคาร|เฟส|ยูส|line|user|id))(?:\s*เล่น)?\s*[:：=\-]?\s*([^\s,;:：\/|()\[\]{}]{1,30})/i;

  // A note line that starts with "พี่", for example "พี่บราวน์". The title stays part of the name.
  const TITLED = /^[ \t]*(พี่[ \t]?[^\s,;:：\/|()\[\]{}]{1,30})/m;

  // Other titles count only when the short name is the whole line, because these words also start ordinary sentences.
  const TITLED_LINE = /^[ \t]*((?:คุณ|เฮีย|เจ๊)[ \t]?[^\s,;:：\/|()\[\]{}]{1,12})[ \t]*$/m;

  function extractName(noteText) {
    const text = noteText || '';
    const titled = TITLED.exec(text) || TITLED_LINE.exec(text);
    if (titled) return titled[1].replace(/[ \t]/g, '');
    const match = NAME.exec(text);
    return match ? match[1] : '';
  }

  root.QRExtractName = extractName;
  if (typeof module !== 'undefined') module.exports = { extractName };
})(typeof globalThis !== 'undefined' ? globalThis : this);
