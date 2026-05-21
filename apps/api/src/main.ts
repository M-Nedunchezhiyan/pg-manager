import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // ── Hardening ──────────────────────────────────────────────────────────
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", env.WEB_URL],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts:
        env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
    }),
  );

  app.use(compression());
  app.use(cookieParser(env.JWT_ACCESS_SECRET));

  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    maxAge: 600,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api', { exclude: ['health', 'readyz'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );

  app.enableShutdownHooks();

  // ── Swagger (dev only — never exposed in production) ──────────────────
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PG Manager API')
      .setVersion('1.0')
      .addCookieAuth('pgm_access')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(env.API_PORT, '0.0.0.0');
  console.warn(`API listening on :${env.API_PORT}`);
  if (env.NODE_ENV !== 'production') {
    console.warn(`Swagger:   http://localhost:${env.API_PORT}/api/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
