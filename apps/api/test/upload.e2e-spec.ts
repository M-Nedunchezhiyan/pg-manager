import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

// 1x1 transparent PNG.
const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63600000000200015db5d8c40000000049454e44ae426082',
  'hex',
);

describe('Uploads (e2e, local FS)', () => {
  let app: INestApplication;
  let prisma: any;
  let redis: any;
  let agent: ReturnType<typeof request>;
  let tmpRoot: string;

  beforeAll(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'pgm-upload-'));
    process.env['STORAGE_ROOT'] = tmpRoot;
    // Require AFTER STORAGE_ROOT is in place so env validation passes.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildTestApp } = require('./test-app');
    ({ app, prisma, redis } = await buildTestApp());
    agent = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resetDb, resetRedis } = require('./test-app');
    await resetDb(prisma);
    await resetRedis(redis);
  });

  it('uploads a PNG and serves it back through /files/:key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedAndAuth } = require('./helpers');
    const { cookie } = await seedAndAuth(prisma, agent);

    const up = await agent
      .post('/api/v1/uploads/resident-photo')
      .set('Cookie', cookie)
      .attach('file', PNG_1x1, { filename: 'photo.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.key).toMatch(/^resident-photo\//);
    expect(up.body.url).toMatch(/^\/api\/v1\/files\//);

    const get = await agent.get(up.body.url).set('Cookie', cookie);
    expect(get.status).toBe(200);
    expect(get.headers['content-type']).toContain('image/png');
    expect((get.body as Buffer).length).toBeGreaterThan(0);
  });

  it('rejects files with mismatched MIME / magic header', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedAndAuth } = require('./helpers');
    const { cookie } = await seedAndAuth(prisma, agent);
    const notAPng = Buffer.from('this is not a png');
    const r = await agent
      .post('/api/v1/uploads/resident-photo')
      .set('Cookie', cookie)
      .attach('file', notAPng, { filename: 'fake.png', contentType: 'image/png' });
    expect(r.status).toBe(400);
  });

  it('refuses unauthenticated download of an existing file', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedAndAuth } = require('./helpers');
    const { cookie } = await seedAndAuth(prisma, agent);
    const up = await agent
      .post('/api/v1/uploads/resident-photo')
      .set('Cookie', cookie)
      .attach('file', PNG_1x1, { filename: 'photo.png', contentType: 'image/png' });

    const r = await agent.get(up.body.url); // no cookie
    expect(r.status).toBe(401);
  });

  it('rejects path traversal attempts in /files/:key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedAndAuth } = require('./helpers');
    const { cookie } = await seedAndAuth(prisma, agent);
    const r = await agent.get('/api/v1/files/..%2F..%2Fetc%2Fpasswd').set('Cookie', cookie);
    expect([400, 404]).toContain(r.status);
  });
});
