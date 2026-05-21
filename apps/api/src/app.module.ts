import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { env } from './config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BedModule } from './modules/bed/bed.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { FloorModule } from './modules/floor/floor.module';
import { FoodModule } from './modules/food/food.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PgModule } from './modules/pg/pg.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { ResidentModule } from './modules/resident/resident.module';
import { RoomModule } from './modules/room/room.module';
import { SharingTypeModule } from './modules/sharing-type/sharing-type.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport:
          env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.code',
            'req.body.passwordHash',
            'req.body.phone',
            'req.body.alternatePhone',
            'req.body.primaryContactPhone',
            'req.body.idProofNumber',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
        customProps: () => ({ service: 'api' }),
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: env.THROTTLE_TTL_SECONDS * 1000, limit: env.THROTTLE_LIMIT },
      { name: 'auth', ttl: 60_000, limit: env.AUTH_THROTTLE_LIMIT },
    ]),
    RedisModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    PgModule,
    FloorModule,
    SharingTypeModule,
    RoomModule,
    BedModule,
    ResidentModule,
    PaymentModule,
    FoodModule,
    ExpenseModule,
    DashboardModule,
    NotificationModule,
    UploadModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // default-deny; @Public() opts out
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
