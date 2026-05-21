import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { PrismaService } from '../src/modules/prisma/prisma.service';
import { buildTestApp, resetDb, resetRedis } from './test-app';
import { seedAndAuth } from './helpers';

describe('Food (e2e)', () => {
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

  it('end-to-end: items → group (default) → menu pickup via apply-defaults', async () => {
    const { cookie } = await seedAndAuth(prisma, agent);
    const pg = await agent.post('/api/v1/pgs').set('Cookie', cookie).send({
      name: 'PG', type: 'COED', address: 'a', city: 'C', state: 'S', pincode: '560001',
    });

    // Two items
    const idly = await agent.post('/api/v1/food/items').set('Cookie', cookie).send({ name: 'Idly' });
    const vada = await agent.post('/api/v1/food/items').set('Cookie', cookie).send({ name: 'Vada' });

    // Duplicate item rejected
    const dup = await agent.post('/api/v1/food/items').set('Cookie', cookie).send({ name: 'Idly' });
    expect(dup.status).toBe(409);

    // Default breakfast group
    const grp = await agent.post('/api/v1/food/groups').set('Cookie', cookie).send({
      pgId: pg.body.id,
      name: 'South Indian',
      mealType: 'BREAKFAST',
      itemIds: [idly.body.id, vada.body.id],
      isDefault: true,
    });
    expect(grp.status).toBe(201);
    expect(grp.body.isDefault).toBe(true);

    // Apply defaults for today
    const today = new Date().toISOString().slice(0, 10);
    const ap = await agent
      .post(`/api/v1/food/menus/apply-defaults?pgId=${pg.body.id}&date=${today}`)
      .set('Cookie', cookie);
    expect(ap.status).toBe(201);
    expect(ap.body.applied).toBe(1); // breakfast only

    // Verify menu is returned
    const menus = await agent
      .get(`/api/v1/food/menus?pgId=${pg.body.id}&from=${today}&to=${today}`)
      .set('Cookie', cookie);
    expect(menus.status).toBe(200);
    expect(menus.body[0].group.name).toBe('South Indian');
  });

  it('setting a new default demotes the previous default', async () => {
    const { cookie } = await seedAndAuth(prisma, agent);
    const pg = await agent.post('/api/v1/pgs').set('Cookie', cookie).send({
      name: 'PG', type: 'COED', address: 'a', city: 'C', state: 'S', pincode: '560001',
    });
    const item = await agent.post('/api/v1/food/items').set('Cookie', cookie).send({ name: 'Bread' });

    const g1 = await agent.post('/api/v1/food/groups').set('Cookie', cookie).send({
      pgId: pg.body.id, name: 'A', mealType: 'BREAKFAST', itemIds: [item.body.id], isDefault: true,
    });
    const g2 = await agent.post('/api/v1/food/groups').set('Cookie', cookie).send({
      pgId: pg.body.id, name: 'B', mealType: 'BREAKFAST', itemIds: [item.body.id], isDefault: true,
    });

    const list = await agent.get(`/api/v1/food/groups?pgId=${pg.body.id}`).set('Cookie', cookie);
    const refreshed = list.body as Array<{ id: string; isDefault: boolean }>;
    expect(refreshed.find((g) => g.id === g1.body.id)?.isDefault).toBe(false);
    expect(refreshed.find((g) => g.id === g2.body.id)?.isDefault).toBe(true);
  });
});
