import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@pg/db';
import request from 'supertest';

import type { PrismaService } from '../src/modules/prisma/prisma.service';
import { buildTestApp, resetDb, resetRedis } from './test-app';
import { currentTotp, seedUser } from './factories';

function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown;
  const arr = Array.isArray(raw) ? raw : raw ? [raw as string] : [];
  return arr.map((c) => c.split(';')[0]).find((c) => c?.startsWith(`${name}=`));
}

async function fullLogin(agent: ReturnType<typeof request>, email: string, password: string, secret: string) {
  const login = await agent.post('/api/v1/auth/login').send({ email, password });
  const mfa = getCookie(login, 'pgm_mfa')!;
  const verify = await agent
    .post('/api/v1/auth/2fa/verify')
    .set('Cookie', mfa)
    .send({ code: currentTotp(secret) });
  const access = getCookie(verify, 'pgm_access')!;
  return access;
}

describe('PG scope (e2e)', () => {
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

  it('Manager cannot read a PG outside their scope', async () => {
    const owner = await seedUser(prisma, { role: UserRole.OWNER, withTotp: true });
    const ownerCookie = await fullLogin(agent, owner.email, owner.password, owner.totpSecretBase32!);

    // Owner creates two PGs.
    const a = await agent
      .post('/api/v1/pgs')
      .set('Cookie', ownerCookie)
      .send({
        name: 'PG A',
        type: 'COED',
        address: 'addr A',
        city: 'City',
        state: 'State',
        pincode: '560001',
      });
    const b = await agent
      .post('/api/v1/pgs')
      .set('Cookie', ownerCookie)
      .send({
        name: 'PG B',
        type: 'COED',
        address: 'addr B',
        city: 'City',
        state: 'State',
        pincode: '560001',
      });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    // Manager scoped only to PG A.
    const mgr = await seedUser(prisma, { role: UserRole.MANAGER, withTotp: true });
    await prisma.userPGScope.create({ data: { userId: mgr.id, pgId: a.body.id } });
    const mgrCookie = await fullLogin(agent, mgr.email, mgr.password, mgr.totpSecretBase32!);

    // Reading PG A — allowed.
    const readA = await agent.get(`/api/v1/pgs/${a.body.id}`).set('Cookie', mgrCookie);
    expect(readA.status).toBe(200);

    // Reading PG B — forbidden.
    const readB = await agent.get(`/api/v1/pgs/${b.body.id}`).set('Cookie', mgrCookie);
    expect(readB.status).toBe(403);

    // List endpoint returns ONLY scoped PGs for manager.
    const list = await agent.get('/api/v1/pgs').set('Cookie', mgrCookie);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(a.body.id);

    // POST a PG → forbidden for manager (OWNER only).
    const create = await agent
      .post('/api/v1/pgs')
      .set('Cookie', mgrCookie)
      .send({
        name: 'PG C',
        type: 'COED',
        address: 'addr',
        city: 'City',
        state: 'State',
        pincode: '560001',
      });
    expect(create.status).toBe(403);
  });
});
