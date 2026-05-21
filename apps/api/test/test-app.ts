/* eslint-disable @typescript-eslint/no-explicit-any */
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../src/app.module';
import { env } from '../src/config/env';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { REDIS } from '../src/modules/redis/redis.module';

export async function buildTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(cookieParser(env.JWT_ACCESS_SECRET));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api', { exclude: ['health', 'readyz'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get(REDIS) as any;

  return { app, prisma, redis };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  // Clean order matters because of FK constraints.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.advance.deleteMany(),
    prisma.allocation.deleteMany(),
    prisma.resident.deleteMany(),
    prisma.bed.deleteMany(),
    prisma.room.deleteMany(),
    prisma.sharingType.deleteMany(),
    prisma.floor.deleteMany(),
    prisma.pGSettings.deleteMany(),
    prisma.pG.deleteMany(),
    prisma.totpBackupCode.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.userPGScope.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function resetRedis(redis: any): Promise<void> {
  await redis.flushdb();
}
