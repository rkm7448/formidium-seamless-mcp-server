/**
 * Formidium AES-256 Signature Generator
 *
 * Based on the Python reference implementation in Formidium docs:
 *   message  = timestamp + apiKey + passPhrase + apiSecret
 *   key      = PBKDF2(apiSecret, passPhrase, SHA-256, 65536 iterations, 32 bytes)
 *   iv       = 16 zero bytes
 *   cipher   = AES-256-CBC(key, iv, PKCS7-padded message)
 *   result   = base64(ciphertext)
 */

import forge from 'node-forge';

/**
 * @param {string} apiKey
 * @param {string} apiSecret
 * @param {string} passPhrase
 * @param {number} currentTime  - Unix timestamp in milliseconds
 * @returns {string} base64-encoded AES-256-CBC ciphertext
 */
export function generateSignature(apiKey, apiSecret, passPhrase, currentTime) {
  const message = String(currentTime) + apiKey + passPhrase + apiSecret;

  // PBKDF2-SHA256: key = apiSecret (as bytes), salt = passPhrase (as bytes)
  const keyBytes = forge.pkcs5.pbkdf2(
    apiSecret,          // password
    passPhrase,         // salt
    65536,              // iterations
    32,                 // key length in bytes
    forge.md.sha256.create()
  );

  // AES-256-CBC with zero IV
  const iv = forge.util.createBuffer('\x00'.repeat(16));
  const cipher = forge.cipher.createCipher('AES-CBC', keyBytes);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(message, 'utf8'));
  cipher.finish(); // applies PKCS7 padding automatically

  return forge.util.encode64(cipher.output.getBytes());
}

/**
 * Build the 5 required headers for every Formidium API call.
 */
export function buildHeaders(apiKey, apiSecret, passPhrase, timeZone) {
  const timeStamp = Date.now();
  const signature = generateSignature(apiKey, apiSecret, passPhrase, timeStamp);

  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    timeStamp: String(timeStamp),
    timeZone: timeZone,
    signature: signature,
    'User-Agent':
      'Mozilla/5.0 (compatible; FormidiumMCP/1.0)',
  };
}
