import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/modules/prisma/prisma.service';
import { buildTestApp, resetDb, resetRedis } from './test-app';
import { seedAndAuth } from './helpers';

describe('Expenses + Dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: any;
  let agent: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, prisma, redis } = await buildTestApp());
    agent = request(app.getHttpServer());
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    await resetRedis(redis);
  });

  it('records expenses, lists them, and reflects them in dashboard P&L', async () => {
    const { cookie } = await seedAndAuth(prisma, agent);
    const pg = await agent.post('/api/v1/pgs').set('Cookie', cookie).send({
      name: 'PG', type: 'COED', address: 'a', city: 'C', state: 'S', pincode: '560001',
    });

    const today = new Date().toISOString().slice(0, 10);
    const e1 = await agent.post('/api/v1/expenses').set('Cookie', cookie).send({
      pgId: pg.body.id, category: 'ELECTRICITY', amount: 250_000, spentOn: today, note: 'Apr bill',
    });
    expect(e1.status).toBe(201);
    const e2 = await agent.post('/api/v1/expenses').set('Cookie', cookie).send({
      pgId: pg.body.id, category: 'WATER', amount: 75_000, spentOn: today,
    });
    expect(e2.status).toBe(201);

    const list = await agent.get(`/api/v1/expenses?pgId=${pg.body.id}`).set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);

    const dash = await agent.get(`/api/v1/dashboard/pg/${pg.body.id}`).set('Cookie', cookie);
    expect(dash.status).toBe(200);
    expect(dash.body.thisMonth.expenses).toBe(325_000);
    expect(dash.body.thisMonth.revenue).toBe(0);
    expect(dash.body.thisMonth.net).toBe(-325_000);
  });
});
