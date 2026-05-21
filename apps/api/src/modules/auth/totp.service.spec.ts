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

import { authenticator } from '@otplib/preset-default';

import { encryptPII } from '../../common/crypto/pii';
import { TotpService } from './totp.service';

/**
 * Pure-logic tests using an in-memory fake of PrismaService. We exercise
 * verifyCodeOrBackup() — the only branch users actually hit at login.
 */

interface FakeUser {
  id: string;
  totpSecretEncrypted: string | null;
  totpEnabled: boolean;
}
interface FakeBackup {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
}

function makeFakePrisma(initial: { users: FakeUser[]; backups: FakeBackup[] }) {
  const state = { users: [...initial.users], backups: [...initial.backups] };
  return {
    user: {
      findUnique: async ({ where: { id } }: { where: { id: string } }) =>
        state.users.find((u) => u.id === id) ?? null,
    },
    totpBackupCode: {
      findUnique: async ({
        where: { userId_codeHash },
      }: {
        where: { userId_codeHash: { userId: string; codeHash: string } };
      }) =>
        state.backups.find(
          (b) => b.userId === userId_codeHash.userId && b.codeHash === userId_codeHash.codeHash,
        ) ?? null,
      updateMany: async ({
        where: { id, usedAt },
        data,
      }: {
        where: { id: string; usedAt: null };
        data: { usedAt: Date };
      }) => {
        const row = state.backups.find((b) => b.id === id);
        if (!row || row.usedAt !== usedAt) return { count: 0 };
        row.usedAt = data.usedAt;
        return { count: 1 };
      },
    },
    state,
  };
}

describe('TotpService.verifyCodeOrBackup', () => {
  authenticator.options = { step: 30, digits: 6, window: 1 };

  it('accepts a valid 6-digit TOTP', async () => {
    const secret = authenticator.generateSecret();
    const fake = makeFakePrisma({
      users: [{ id: 'u1', totpSecretEncrypted: encryptPII(secret), totpEnabled: true }],
      backups: [],
    });
    const svc = new TotpService(fake as never);
    const code = authenticator.generate(secret);
    expect(await svc.verifyCodeOrBackup('u1', code)).toBe(true);
  });

  it('rejects a wrong 6-digit code', async () => {
    const secret = authenticator.generateSecret();
    const fake = makeFakePrisma({
      users: [{ id: 'u1', totpSecretEncrypted: encryptPII(secret), totpEnabled: true }],
      backups: [],
    });
    const svc = new TotpService(fake as never);
    expect(await svc.verifyCodeOrBackup('u1', '000000')).toBe(false);
  });

  it('returns false when user has no TOTP secret', async () => {
    const fake = makeFakePrisma({
      users: [{ id: 'u1', totpSecretEncrypted: null, totpEnabled: false }],
      backups: [],
    });
    const svc = new TotpService(fake as never);
    expect(await svc.verifyCodeOrBackup('u1', '123456')).toBe(false);
  });

  it('accepts a single-use backup code, but only once', async () => {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update('abcdef0123').digest('hex');
    const fake = makeFakePrisma({
      users: [{ id: 'u1', totpSecretEncrypted: null, totpEnabled: true }],
      backups: [{ id: 'b1', userId: 'u1', codeHash: hash, usedAt: null }],
    });
    const svc = new TotpService(fake as never);
    expect(await svc.verifyCodeOrBackup('u1', 'abcd-ef0123')).toBe(true);
    // Second use of the same backup code must fail.
    expect(await svc.verifyCodeOrBackup('u1', 'abcdef0123')).toBe(false);
  });
});
