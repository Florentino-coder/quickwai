// Finds the customer name in LINE OA note text. Only text after the word "ชื่อ" counts.
(function (root) {
  const NAME = /ชื่อ(?!\s*(?:บัญชี|ผู้ใช้|ไลน์|ธนาคาร|เฟส|ยูส|line|user|id))(?:\s*[-\/]?\s*(?:นาม)?สกุล)?(?:\s*เล่น)?\s*[:：=\-]?\s*([^\s,;:：\/|()\[\]{}]{1,30})/i;

  function extractName(noteText) {
    const match = NAME.exec(noteText || '');
    return match ? match[1] : '';
  }

  root.QRExtractName = extractName;
  if (typeof module !== 'undefined') module.exports = { extractName };
})(typeof globalThis !== 'undefined' ? globalThis : this);
