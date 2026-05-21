import { z } from 'zod';

// Validate process.env once at boot. Fail fast on missing/weak secrets.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be ≥32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  PII_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'PII_ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  SHARED_CIPHER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'SHARED_CIPHER_KEY must be 64 hex chars (32 bytes)'),

  // Local filesystem storage for uploaded files.
  STORAGE_ROOT: z.string().min(1),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
