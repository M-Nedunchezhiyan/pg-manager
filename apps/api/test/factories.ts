import { UserRole } from '@pg/db';

import { hashPassword } from '../src/modules/auth/argon';
import { encryptPII } from '../src/common/crypto/pii';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

export interface SeededUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  totpSecretBase32?: string;
}

export async function seedUser(
  prisma: PrismaService,
  opts: { email?: string; password?: string; role?: UserRole; withTotp?: boolean } = {},
): Promise<SeededUser> {
  const email = opts.email ?? `user_${Math.random().toString(36).slice(2, 8)}@test.local`;
  const password = opts.password ?? 'CorrectHorse!Battery9';
  const role = opts.role ?? UserRole.OWNER;

  const data: Parameters<PrismaService['user']['create']>[0]['data'] = {
    email,
    name: 'Test User',
    role,
    passwordHash: await hashPassword(password),
  };

  let totpSecretBase32: string | undefined;
  if (opts.withTotp) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { authenticator } = require('@otplib/preset-default');
    totpSecretBase32 = authenticator.generateSecret() as string;
    data.totpEnabled = true;
    data.totpSecretEncrypted = encryptPII(totpSecretBase32);
    data.totpEnrolledAt = new Date();
  }

  const u = await prisma.user.create({ data });
  const result: SeededUser = { id: u.id, email, password, role };
  if (totpSecretBase32) result.totpSecretBase32 = totpSecretBase32;
  return result;
}

export function currentTotp(secret: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { authenticator } = require('@otplib/preset-default');
  return authenticator.generate(secret) as string;
}
