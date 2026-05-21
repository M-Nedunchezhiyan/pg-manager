/**
 * Browser-side counterpart to apps/api/src/common/crypto/sym-cipher.ts.
 * Same algorithm: AES-256-GCM, base64url( iv(12) | tag(16) | ciphertext ).
 *
 * SECURITY NOTE: the key comes from NEXT_PUBLIC_SHARED_CIPHER_KEY and is
 * therefore visible in the JS bundle. This is obfuscation, not secrecy —
 * use it to keep raw IDs / tokens out of casual inspection (DevTools,
 * screenshots). Real protection still comes from HTTPS, httpOnly cookies
 * and server-side auth.
 */

const KEY_HEX = process.env['NEXT_PUBLIC_SHARED_CIPHER_KEY'] ?? '';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
      throw new Error('NEXT_PUBLIC_SHARED_CIPHER_KEY must be 64 hex chars');
    }
    const raw = hexToBytes(KEY_HEX);
    cachedKey = crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  }
  return cachedKey;
}

export async function symEncrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  // Web Crypto appends the tag at the end of `ct`. Match the server format
  // (iv | tag | ciphertext) by splitting and re-arranging.
  const body = ct.slice(0, ct.length - TAG_LEN);
  const tag = ct.slice(ct.length - TAG_LEN);
  const out = new Uint8Array(IV_LEN + TAG_LEN + body.length);
  out.set(iv, 0);
  out.set(tag, IV_LEN);
  out.set(body, IV_LEN + TAG_LEN);
  return bytesToBase64Url(out);
}

export async function symDecrypt(payload: string): Promise<string> {
  const buf = base64UrlToBytes(payload);
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('Invalid ciphertext');
  const iv = buf.slice(0, IV_LEN);
  const tag = buf.slice(IV_LEN, IV_LEN + TAG_LEN);
  const body = buf.slice(IV_LEN + TAG_LEN);
  // Web Crypto expects `ciphertext | tag` together.
  const ct = new Uint8Array(body.length + tag.length);
  ct.set(body, 0);
  ct.set(tag, body.length);
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 },
    key,
    ct,
  );
  return new TextDecoder().decode(plain);
}

// ── helpers ──────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
