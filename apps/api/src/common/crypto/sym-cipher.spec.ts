// Ensure the cipher loads with a test key BEFORE we import it.
process.env['SHARED_CIPHER_KEY'] =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env['PII_ENCRYPTION_KEY'] =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env['DATABASE_URL'] = 'postgresql://x:y@localhost:5432/z?schema=public';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['API_URL'] = 'http://localhost:4000';
process.env['WEB_URL'] = 'http://localhost:3000';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(40);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(40);
process.env['STORAGE_ROOT'] = '/tmp/pgm-test';

import { symDecrypt, symEncrypt, tryDecrypt } from './sym-cipher';

describe('sym-cipher (server)', () => {
  it('round-trips arbitrary UTF-8 strings', () => {
    const samples = ['hello', '🚀 emoji 😀', 'a'.repeat(1024), 'cuid_abc123_xyz'];
    for (const s of samples) {
      expect(symDecrypt(symEncrypt(s))).toBe(s);
    }
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = symEncrypt('same');
    const b = symEncrypt('same');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext (GCM tag mismatch)', () => {
    const ct = symEncrypt('secret');
    // Flip a bit in the middle of the payload.
    const tampered = ct.slice(0, -2) + (ct.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => symDecrypt(tampered)).toThrow();
  });

  it('rejects too-short payloads', () => {
    expect(() => symDecrypt('AAAA')).toThrow();
  });

  it('tryDecrypt returns input unchanged on failure', () => {
    expect(tryDecrypt('not-encrypted')).toBe('not-encrypted');
  });
});
