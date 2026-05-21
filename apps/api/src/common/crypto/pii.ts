import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

import { env } from '../../config/env';

/**
 * AES-256-GCM symmetric encryption for PII at rest (phone, alt phone, etc.).
 * Format: base64( iv(12) | tag(16) | ciphertext )
 *
 * - Key is loaded from PII_ENCRYPTION_KEY (32-byte hex, validated at boot).
 * - For searchable fields we ALSO store an HMAC-SHA256 hash so we can `WHERE phoneHash = ?`
 *   without ever decrypting (and without exposing equality via deterministic encryption).
 */

const KEY = Buffer.from(env.PII_ENCRYPTION_KEY, 'hex');
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptPII(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptPII(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Invalid ciphertext');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Deterministic HMAC for searchable lookups (phone uniqueness, ID dedup). */
export function hashPII(value: string): string {
  return createHmac('sha256', KEY).update(value.trim().toLowerCase()).digest('hex');
}
