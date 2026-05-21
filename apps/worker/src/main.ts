import IORedis from 'ioredis';
import pino from 'pino';
import { z } from 'zod';

import { registerRentDueScan } from './jobs/rent-due.scan';

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
});

const envSchema = z.object({
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.string().default('development'),
});

const env = envSchema.parse(process.env);

async function main() {
  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by bullmq
    enableReadyCheck: true,
  });

  connection.on('error', (err) => log.error({ err }, 'redis error'));
  connection.on('ready', () => log.info('redis connected'));

  // Register scheduled jobs.
  await registerRentDueScan({ connection, log });

  log.info('worker started');

  const shutdown = async (signal: string) => {
    log.warn({ signal }, 'shutting down worker');
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.fatal({ err }, 'worker fatal');
  process.exit(1);
});
