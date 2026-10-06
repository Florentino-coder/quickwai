// Builds an activation code in the browser (or Node) with WebCrypto.
// Must produce the same format as desktop/license.js.
(function (root) {
  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  async function importPrivateKey(pem) {
    const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
  }

  async function issueCode(pem, { name, expiresAt, machine }) {
    const key = await importPrivateKey(pem);
    const payload = b64url(new TextEncoder().encode(JSON.stringify({ n: name, e: expiresAt, m: machine || '' })));
    const signature = await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(payload));
    return `QR1.${payload}.${b64url(signature)}`;
  }

  root.QRIssuer = { issueCode };
  if (typeof module !== 'undefined') module.exports = { issueCode };
})(typeof globalThis !== 'undefined' ? globalThis : this);
