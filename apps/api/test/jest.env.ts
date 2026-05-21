// Loaded BEFORE config/env.ts validates process.env.
// Provides safe defaults so the e2e tests can boot without a real .env file.

const set = (k: string, v: string) => {
  if (!process.env[k]) process.env[k] = v;
};

set('NODE_ENV', 'test');
set('LOG_LEVEL', 'error');
set('API_PORT', '4001');
set('API_URL', 'http://localhost:4001');
set('WEB_URL', 'http://localhost:3000');
set('CORS_ORIGIN', 'http://localhost:3000');

// Caller is expected to provide a real DATABASE_URL + REDIS_URL via env.
// We fall back to the docker-compose dev defaults.
set('DATABASE_URL', 'postgresql://postgres:apple%40123@localhost:5432/pgmanager_test?schema=public&sslmode=prefer');
set('REDIS_URL', 'redis://:change_me_redis_password@localhost:6379');

// Test-only secrets (NEVER use these in prod).
set('JWT_ACCESS_SECRET', 'test_access_secret_at_least_thirty_two_chars_long_xxxx');
set('JWT_REFRESH_SECRET', 'test_refresh_secret_at_least_thirty_two_chars_long_xxxx');
set('JWT_ACCESS_TTL', '15m');
set('JWT_REFRESH_TTL', '7d');
set('PII_ENCRYPTION_KEY', '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff');

set('STORAGE_ROOT', '/tmp/pgm-test-uploads');
set('SHARED_CIPHER_KEY', '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff');

set('THROTTLE_TTL_SECONDS', '60');
set('THROTTLE_LIMIT', '1000'); // relaxed in tests so we don't 429 ourselves
set('AUTH_THROTTLE_LIMIT', '1000');
