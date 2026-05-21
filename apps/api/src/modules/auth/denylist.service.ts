import { Inject, Injectable } from '@nestjs/common';

import { REDIS, type RedisClient } from '../redis/redis.module';

/**
 * JWT denylist — Redis-backed, jti-keyed.
 *
 * Every JWT we issue carries a unique `jti`. On logout, 2FA-verify success,
 * password change, or admin revoke, we insert `jti → 1` with TTL equal to the
 * token's remaining lifetime. The JWT strategy consults this on every request
 * and rejects matches with 401 — so the token is dead regardless of how it's
 * presented (cookie, Bearer header, Postman, Swagger).
 *
 * Also supports a per-user "tokens-issued-before" cutoff so changing a password
 * invalidates every access token previously issued in one shot (single Redis
 * key per user, no enumeration needed).
 */
@Injectable()
export class DenylistService {
  private static readonly JTI_PREFIX = 'jwt:deny:jti:';
  private static readonly USER_CUTOFF_PREFIX = 'jwt:cutoff:user:';

  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  /** Deny a specific jti for at most `ttlSeconds`. Idempotent. */
  async denyJti(jti: string, ttlSeconds: number): Promise<void> {
    if (!jti || ttlSeconds <= 0) return;
    await this.redis.set(`${DenylistService.JTI_PREFIX}${jti}`, '1', 'EX', Math.ceil(ttlSeconds));
  }

  async isJtiDenied(jti: string): Promise<boolean> {
    if (!jti) return false;
    const v = await this.redis.get(`${DenylistService.JTI_PREFIX}${jti}`);
    return v === '1';
  }

  /**
   * Deny every token issued for `userId` strictly before `issuedAtUnix`.
   * Used on password change / global session kill.
   */
  async setUserCutoff(userId: string, issuedAtUnix: number, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      `${DenylistService.USER_CUTOFF_PREFIX}${userId}`,
      String(issuedAtUnix),
      'EX',
      Math.ceil(ttlSeconds),
    );
  }

  async getUserCutoff(userId: string): Promise<number | null> {
    const v = await this.redis.get(`${DenylistService.USER_CUTOFF_PREFIX}${userId}`);
    return v ? Number(v) : null;
  }
}
