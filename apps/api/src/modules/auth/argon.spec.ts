import { hashPassword, needsRehash, verifyPassword } from './argon';

describe('argon password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('CorrectHorse!Battery9');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'CorrectHorse!Battery9')).toBe(true);
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('returns false (not throw) for malformed hashes', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('needsRehash false for fresh hash, true for legacy params', async () => {
    const fresh = await hashPassword('AnotherPass!1234');
    expect(needsRehash(fresh)).toBe(false);
    // A hash with smaller memoryCost is legacy.
    const legacy =
      '$argon2id$v=19$m=4096,t=2,p=1$dGltaW5nLXNhZmUtZHVtbXkkc2FsdA$dGltaW5nLXNhZmUtZHVtbXktaGFzaC1mb3ItY29uc3RhbnQtdGltZQ';
    expect(needsRehash(legacy)).toBe(true);
  });
});
