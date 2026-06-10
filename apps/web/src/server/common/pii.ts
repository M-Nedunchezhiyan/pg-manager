// PII encryption helpers — same AES-256-GCM + HMAC scheme as the previous
// NestJS API. The key is read from PII_ENCRYPTION_KEY lazily on first use.
//
// Lazy (not module-load) validation is deliberate: `next build` imports every
// route module to collect page data, so throwing at import time would fail the
// build whenever the secret isn't present in the build environment. We instead
// fail fast on the first actual encrypt/decrypt/hash call at runtime.
//
// IMPORTANT: never expose this module to client code. Only import from
// Route Handlers / server-side code.

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const rawKey = process.env.PII_ENCRYPTION_KEY;
  if (!rawKey || !/^[0-9a-f]{64}$/i.test(rawKey)) {
    throw new Error(
      'PII_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32',
    );
  }
  cachedKey = Buffer.from(rawKey, 'hex');
  return cachedKey;
}

export function encryptPII(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptPII(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('Invalid ciphertext');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Deterministic HMAC for searchable lookups (phone uniqueness, ID dedup). */
export function hashPII(value: string): string {
  return createHmac('sha256', getKey()).update(value.trim().toLowerCase()).digest('hex');
}
