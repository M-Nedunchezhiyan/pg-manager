import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../../config/env';

/**
 * Shared AES-256-GCM cipher used to wrap values that travel between the
 * server and the browser — JWT cookie bodies, opaque ID payloads, etc.
 *
 * Wire format: base64url( iv(12) | tag(16) | ciphertext )
 *
 * SECURITY NOTE: the same key is also exposed to the browser as
 * NEXT_PUBLIC_SHARED_CIPHER_KEY. That makes this obfuscation, not secrecy —
 * anyone who reads the JS bundle can recover the key. The real protections
 * are HTTPS in transit, httpOnly cookies, server-side auth and the per-jti
 * denylist. Use this cipher to keep raw cuid/JWT strings off the wire and
 * out of casual inspection (DevTools, Postman screenshots, copy-paste).
 */

const KEY = Buffer.from(env.SHARED_CIPHER_KEY, 'hex');
const IV_LEN = 12;
const TAG_LEN = 16;

if (KEY.length !== 32) {
  throw new Error('SHARED_CIPHER_KEY must decode to 32 bytes');
}

export function symEncrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return toBase64Url(Buffer.concat([iv, tag, ct]));
}

export function symDecrypt(payload: string): string {
  const buf = fromBase64Url(payload);
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('Invalid ciphertext');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Returns the input untouched if decryption fails — for backward compatibility. */
export function tryDecrypt(payload: string): string {
  try {
    return symDecrypt(payload);
  } catch {
    return payload;
  }
}

function toBase64Url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}
