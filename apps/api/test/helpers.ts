import { UserRole } from '@pg/db';
import request from 'supertest';

import type { PrismaService } from '../src/modules/prisma/prisma.service';
import { currentTotp, seedUser, type SeededUser } from './factories';
import { unwrap } from '../src/modules/auth/cookies';

function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown;
  const arr = Array.isArray(raw) ? raw : raw ? [raw as string] : [];
  return arr.map((c) => c.split(';')[0]).find((c) => c?.startsWith(`${name}=`));
}

export async function authenticate(
  agent: ReturnType<typeof request>,
  user: SeededUser,
): Promise<string> {
  const login = await agent.post('/api/v1/auth/login').send({ email: user.email, password: user.password });
  const mfa = getCookie(login, 'pgm_mfa');
  if (!mfa) throw new Error('login: missing mfa cookie');
  const verify = await agent
    .post('/api/v1/auth/2fa/verify')
    .set('Cookie', mfa)
    .send({ code: currentTotp(user.totpSecretBase32!) });
  const access = getCookie(verify, 'pgm_access');
  if (!access) throw new Error(`2fa verify failed: ${verify.status} ${JSON.stringify(verify.body)}`);
  return access;
}

/** Seed an OWNER with 2FA enrolled and log in; return a Cookie header value. */
export async function seedAndAuth(
  prisma: PrismaService,
  agent: ReturnType<typeof request>,
  role: UserRole = UserRole.OWNER,
): Promise<{ user: SeededUser; cookie: string }> {
  const user = await seedUser(prisma, { role, withTotp: true });
  const cookie = await authenticate(agent, user);
  return { user, cookie };
}

/** Decrypt a wrapped cookie (handy for tests that decode token internals). */
export function unwrapCookieValue(cookie: string): string {
  const value = cookie.split('=')[1] ?? '';
  return unwrap(value) ?? value;
}
