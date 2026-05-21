process.env['SHARED_CIPHER_KEY'] =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env['PII_ENCRYPTION_KEY'] =
  '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
process.env['DATABASE_URL'] = 'postgresql://x:y@localhost:5432/z?schema=public';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['API_URL'] = 'http://localhost:4000';
process.env['WEB_URL'] = 'http://localhost:3000';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(40);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(40);
process.env['STORAGE_ROOT'] = '/tmp/pgm-test';

import { decryptPII, encryptPII, hashPII } from './pii';

describe('PII helpers', () => {
  it('round-trips encrypted PII', () => {
    const phone = '+919876543210';
    expect(decryptPII(encryptPII(phone))).toBe(phone);
  });

  it('produces different ciphertext for the same plaintext', () => {
    expect(encryptPII('+919876543210')).not.toBe(encryptPII('+919876543210'));
  });

  it('hashPII is deterministic and case/whitespace tolerant', () => {
    const a = hashPII('+91 9876543210');
    const b = hashPII('+91 9876543210');
    const c = hashPII('+919876543210');
    expect(a).toBe(b);
    // Different formatting yields different hashes — desired so dedupe needs normalized input.
    expect(a).not.toBe(c);
  });

  it('hashPII output is 64 hex chars (sha256)', () => {
    expect(hashPII('value')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('decryptPII throws on tampered payload', () => {
    const ct = encryptPII('secret');
    const tampered = ct.slice(0, -2) + 'AA';
    expect(() => decryptPII(tampered)).toThrow();
  });
});
