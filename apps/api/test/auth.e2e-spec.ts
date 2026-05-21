import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/modules/prisma/prisma.service';
import { buildTestApp, resetDb, resetRedis } from './test-app';
import { currentTotp, seedUser } from './factories';

const COOKIE_ACCESS = 'pgm_access';
const COOKIE_REFRESH = 'pgm_refresh';
const COOKIE_MFA = 'pgm_mfa';

function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown;
  const arr = Array.isArray(raw) ? raw : raw ? [raw as string] : [];
  return arr
    .map((c) => c.split(';')[0])
    .find((c) => c?.startsWith(`${name}=`));
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: any;
  let agent: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, prisma, redis } = await buildTestApp());
    agent = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    await resetRedis(redis);
  });

  describe('/auth/login', () => {
    it('rejects unknown email with 401 (constant-time path runs)', async () => {
      const t0 = Date.now();
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.local', password: 'AnyValidPassword1' });
      const elapsed = Date.now() - t0;
      expect(res.status).toBe(401);
      expect(elapsed).toBeGreaterThan(10); // argon2 ran even on miss
    });

    it('rejects wrong password and increments failed count', async () => {
      const u = await seedUser(prisma);
      for (let i = 0; i < 4; i++) {
        const r = await agent
          .post('/api/v1/auth/login')
          .send({ email: u.email, password: 'WrongPassword!' });
        expect(r.status).toBe(401);
      }
      const reloaded = await prisma.user.findUnique({ where: { id: u.id } });
      expect(reloaded?.failedLoginCount).toBe(4);
      expect(reloaded?.lockedUntil).toBeNull();
    });

    it('locks account after 5 failures', async () => {
      const u = await seedUser(prisma);
      for (let i = 0; i < 5; i++) {
        await agent.post('/api/v1/auth/login').send({ email: u.email, password: 'WrongPassword!' });
      }
      const reloaded = await prisma.user.findUnique({ where: { id: u.id } });
      expect(reloaded?.lockedUntil).not.toBeNull();
      // Even with the right password, locked accounts are denied.
      const r = await agent.post('/api/v1/auth/login').send({ email: u.email, password: u.password });
      expect(r.status).toBe(401);
    });

    it('the access cookie value is encrypted (not a raw JWT)', async () => {
      const u = await seedUser(prisma, { withTotp: true });
      const login = await agent.post('/api/v1/auth/login').send({ email: u.email, password: u.password });
      const mfa = getCookie(login, COOKIE_MFA)!;
      const verify = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', mfa)
        .send({ code: currentTotp(u.totpSecretBase32!) });
      const access = getCookie(verify, COOKIE_ACCESS)!;
      const cookieValue = access.split('=')[1] ?? '';
      // A raw JWT starts with 'eyJ' (base64 of '{"a'). Our wrapped cookie must not.
      expect(cookieValue.startsWith('eyJ')).toBe(false);
      const { unwrap } = await import('../src/modules/auth/cookies');
      const unwrapped = unwrap(cookieValue);
      expect(unwrapped?.startsWith('eyJ')).toBe(true);
    });

    it('returns mfa_setup_required on valid password if 2FA not enrolled', async () => {
      const u = await seedUser(prisma);
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email: u.email, password: u.password });
      expect(res.status).toBe(200);
      expect(res.body.step).toBe('mfa_setup_required');
      expect(getCookie(res, COOKIE_MFA)).toBeDefined();
      expect(getCookie(res, COOKIE_ACCESS)).toBeUndefined();
      expect(getCookie(res, COOKIE_REFRESH)).toBeUndefined();
    });

    it('returns mfa_required on valid password if 2FA enrolled', async () => {
      const u = await seedUser(prisma, { withTotp: true });
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email: u.email, password: u.password });
      expect(res.body.step).toBe('mfa_required');
      expect(getCookie(res, COOKIE_MFA)).toBeDefined();
    });
  });

  describe('/auth/2fa/verify', () => {
    it('issues access+refresh on valid TOTP and invalidates MFA token', async () => {
      const u = await seedUser(prisma, { withTotp: true });
      const login = await agent.post('/api/v1/auth/login').send({ email: u.email, password: u.password });
      const mfaCookie = getCookie(login, COOKIE_MFA)!;

      const code = currentTotp(u.totpSecretBase32!);
      const verify = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', mfaCookie)
        .send({ code });

      expect(verify.status).toBe(200);
      expect(verify.body.step).toBe('authenticated');
      expect(getCookie(verify, COOKIE_ACCESS)).toBeDefined();
      expect(getCookie(verify, COOKIE_REFRESH)).toBeDefined();

      // The MFA token must now be DENIED — reusing it must fail.
      const replay = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', mfaCookie)
        .send({ code: currentTotp(u.totpSecretBase32!) });
      expect(replay.status).toBe(401);
    });

    it('rejects wrong TOTP code', async () => {
      const u = await seedUser(prisma, { withTotp: true });
      const login = await agent.post('/api/v1/auth/login').send({ email: u.email, password: u.password });
      const mfaCookie = getCookie(login, COOKIE_MFA)!;

      const verify = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', mfaCookie)
        .send({ code: '000000' });
      expect(verify.status).toBe(401);
    });

    it('rejects access cookie used in place of MFA cookie', async () => {
      // Pre-auth a different user fully, then try to use that access cookie at /2fa/verify.
      const u = await seedUser(prisma, { withTotp: true });
      const login = await agent.post('/api/v1/auth/login').send({ email: u.email, password: u.password });
      const mfa = getCookie(login, COOKIE_MFA)!;
      const ok = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', mfa)
        .send({ code: currentTotp(u.totpSecretBase32!) });
      const accessCookie = getCookie(ok, COOKIE_ACCESS)!;

      const cross = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', accessCookie.replace('pgm_access=', 'pgm_mfa='))
        .send({ code: currentTotp(u.totpSecretBase32!) });
      // An access token has purpose='access', mfa strategy rejects it.
      expect(cross.status).toBe(401);
    });
  });

  describe('Logout invalidates tokens (denylist)', () => {
    it('access token cannot be used after /auth/logout — works regardless of cookie or Bearer header', async () => {
      const u = await seedUser(prisma, { withTotp: true });
      const login = await agent.post('/api/v1/auth/login').send({ email: u.email, password: u.password });
      const mfa = getCookie(login, COOKIE_MFA)!;
      const verified = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', mfa)
        .send({ code: currentTotp(u.totpSecretBase32!) });
      const access = getCookie(verified, COOKIE_ACCESS)!;
      const refresh = getCookie(verified, COOKIE_REFRESH)!;
      // Cookies are now wrapped by the shared cipher; unwrap to get the raw JWT
      // so we can also send it as a Bearer header for the Postman/Swagger case.
      const { unwrap } = await import('../src/modules/auth/cookies');
      const accessJwt = unwrap(access.split('=')[1]) ?? '';

      // sanity: /auth/me works
      const me1 = await agent.get('/api/v1/auth/me').set('Cookie', access);
      expect(me1.status).toBe(200);

      // logout — sends the access + refresh cookies, server denylists the jti.
      const out = await agent
        .post('/api/v1/auth/logout')
        .set('Cookie', `${access}; ${refresh}`);
      expect(out.status).toBe(204);

      // 1. Same cookie no longer works.
      const me2 = await agent.get('/api/v1/auth/me').set('Cookie', access);
      expect(me2.status).toBe(401);

      // 2. Same RAW token as Bearer header (simulates Postman/Swagger) ALSO fails.
      const me3 = await agent.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessJwt}`);
      expect(me3.status).toBe(401);
    });

    it('refresh token cannot be reused after rotation — replay revokes the family', async () => {
      const u = await seedUser(prisma, { withTotp: true });
      const login = await agent.post('/api/v1/auth/login').send({ email: u.email, password: u.password });
      const mfa = getCookie(login, COOKIE_MFA)!;
      const verified = await agent
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', mfa)
        .send({ code: currentTotp(u.totpSecretBase32!) });
      const refresh1 = getCookie(verified, COOKIE_REFRESH)!;

      // First rotation succeeds.
      const r1 = await agent.post('/api/v1/auth/refresh').set('Cookie', refresh1);
      expect(r1.status).toBe(200);
      const refresh2 = getCookie(r1, COOKIE_REFRESH)!;

      // Reusing the OLD refresh token must fail and revoke the new one too.
      const replay = await agent.post('/api/v1/auth/refresh').set('Cookie', refresh1);
      expect(replay.status).toBe(401);

      const afterReplay = await agent.post('/api/v1/auth/refresh').set('Cookie', refresh2);
      expect(afterReplay.status).toBe(401);
    });
  });

  describe('Default-deny across all protected routes', () => {
    it('/auth/me requires auth', async () => {
      const r = await agent.get('/api/v1/auth/me');
      expect(r.status).toBe(401);
    });

    it('/pgs requires auth', async () => {
      const r = await agent.get('/api/v1/pgs');
      expect(r.status).toBe(401);
    });

    it('health endpoints are public', async () => {
      const r = await agent.get('/health');
      expect(r.status).toBe(200);
    });
  });
});
