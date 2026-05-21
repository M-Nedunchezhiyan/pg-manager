import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@pg/db';
import request from 'supertest';

import type { PrismaService } from '../src/modules/prisma/prisma.service';
import { buildTestApp, resetDb, resetRedis } from './test-app';
import { seedAndAuth } from './helpers';

/**
 * E2E: record a payment + read it back via /payments/resident, /ledger and /dues.
 * Requires a running postgres + redis (see jest.env.ts).
 */
describe('Payments (e2e)', () => {
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

  it('records a RENT payment and surfaces it in the resident ledger + dues', async () => {
    const { cookie } = await seedAndAuth(prisma, agent, UserRole.OWNER);

    // Set up a PG with a 2-bed room → onboard one resident
    const pg = await agent.post('/api/v1/pgs').set('Cookie', cookie).send({
      name: 'PG', type: 'COED', address: 'addr', city: 'City', state: 'State', pincode: '560001',
    });
    const floor = await agent.post('/api/v1/floors').set('Cookie', cookie).send({
      pgId: pg.body.id, number: 1, allowedGender: 'ANY',
    });
    const st = await agent.post('/api/v1/sharing-types').set('Cookie', cookie).send({
      pgId: pg.body.id, name: '2-Sharing', capacity: 2, monthlyRent: 500_000,
    });
    const room = await agent.post('/api/v1/rooms').set('Cookie', cookie).send({
      floorId: floor.body.id, sharingTypeId: st.body.id, number: '101',
    });
    const today = new Date().toISOString().slice(0, 10);
    const onb = await agent.post('/api/v1/residents/onboard').set('Cookie', cookie).send({
      pgId: pg.body.id,
      bedId: room.body.beds[0].id,
      fullName: 'Alice',
      phone: '+919876543210',
      gender: 'FEMALE',
      homeAddress: 'home addr', homeCity: 'City', homeState: 'State',
      primaryContactName: 'Mom', primaryContactPhone: '+919812345678',
      workOrInstitution: 'Acme Co',
      joinedOn: today,
      withFood: true,
      advanceAmount: 0,
      firstMonthRent: 0,
      paymentMethod: 'CASH',
    });
    expect(onb.status).toBe(201);

    // Record an explicit RENT payment for this month.
    const now = new Date();
    const rec = await agent.post('/api/v1/payments').set('Cookie', cookie).send({
      residentId: onb.body.id,
      kind: 'RENT',
      forMonth: now.getUTCMonth() + 1,
      forYear: now.getUTCFullYear(),
      amount: 500_000,
      lateFee: 0,
      paidOn: today,
      method: 'UPI',
      reference: 'TX12345',
    });
    expect(rec.status).toBe(201);

    // Same period twice → 409.
    const dup = await agent.post('/api/v1/payments').set('Cookie', cookie).send({
      residentId: onb.body.id,
      kind: 'RENT',
      forMonth: now.getUTCMonth() + 1,
      forYear: now.getUTCFullYear(),
      amount: 100,
      paidOn: today,
      method: 'CASH',
    });
    expect(dup.status).toBe(409);

    // Ledger shows current month PAID.
    const ledger = await agent.get(`/api/v1/payments/ledger/${onb.body.id}`).set('Cookie', cookie);
    expect(ledger.status).toBe(200);
    expect(ledger.body.months[0].status).toBe('PAID');
    expect(ledger.body.months[0].paid).toBe(500_000);

    // Dues for the PG show balance 0 for this resident.
    const dues = await agent.get(`/api/v1/payments/dues?pgId=${pg.body.id}`).set('Cookie', cookie);
    expect(dues.status).toBe(200);
    expect(dues.body[0].balance).toBe(0);
  });

  it('manager scoped to a different PG cannot record payments for this PG', async () => {
    const owner = await seedAndAuth(prisma, agent, UserRole.OWNER);
    // Owner makes two PGs.
    const a = await agent.post('/api/v1/pgs').set('Cookie', owner.cookie).send({
      name: 'A', type: 'COED', address: 'a', city: 'C', state: 'S', pincode: '560001',
    });
    const b = await agent.post('/api/v1/pgs').set('Cookie', owner.cookie).send({
      name: 'B', type: 'COED', address: 'b', city: 'C', state: 'S', pincode: '560001',
    });
    // Manager scoped to A only.
    const mgr = await seedAndAuth(prisma, agent, UserRole.MANAGER);
    await prisma.userPGScope.create({ data: { userId: mgr.user.id, pgId: a.body.id } });

    // Onboard a resident in PG B (via owner).
    const f = await agent.post('/api/v1/floors').set('Cookie', owner.cookie).send({
      pgId: b.body.id, number: 1, allowedGender: 'ANY',
    });
    const st = await agent.post('/api/v1/sharing-types').set('Cookie', owner.cookie).send({
      pgId: b.body.id, name: '1-Sharing', capacity: 1, monthlyRent: 100_000,
    });
    const r = await agent.post('/api/v1/rooms').set('Cookie', owner.cookie).send({
      floorId: f.body.id, sharingTypeId: st.body.id, number: '1',
    });
    const today = new Date().toISOString().slice(0, 10);
    const onb = await agent.post('/api/v1/residents/onboard').set('Cookie', owner.cookie).send({
      pgId: b.body.id, bedId: r.body.beds[0].id, fullName: 'Bob',
      phone: '+919812340000', gender: 'MALE',
      homeAddress: 'h', homeCity: 'C', homeState: 'S',
      primaryContactName: 'C', primaryContactPhone: '+919812340001',
      workOrInstitution: 'W', joinedOn: today, withFood: false,
      advanceAmount: 0, firstMonthRent: 0, paymentMethod: 'CASH',
    });

    // Manager tries to record a payment for that resident → 403.
    const rec = await agent.post('/api/v1/payments').set('Cookie', mgr.cookie).send({
      residentId: onb.body.id,
      kind: 'RENT',
      forMonth: new Date().getUTCMonth() + 1,
      forYear: new Date().getUTCFullYear(),
      amount: 100_000,
      paidOn: today,
      method: 'CASH',
    });
    expect(rec.status).toBe(403);
  });
});
