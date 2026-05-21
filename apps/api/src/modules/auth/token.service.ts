import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@pg/db';

import { env } from '../../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { DenylistService } from './denylist.service';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  jti: string;
  purpose: 'access';
}

export interface MfaTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  jti: string;
  purpose: 'mfa';
}

const ACCESS_TTL_SECONDS = 15 * 60; // matches default JWT_ACCESS_TTL
const MFA_TTL_SECONDS = 5 * 60;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly denylist: DenylistService,
  ) {}

  // ── Access tokens ──────────────────────────────────────────────────────

  signAccess(opts: { userId: string; role: UserRole; email: string }): { token: string; jti: string; expiresIn: number } {
    const jti = randomUUID();
    const token = this.jwt.sign(
      { sub: opts.userId, role: opts.role, email: opts.email, purpose: 'access', jti } satisfies Omit<AccessTokenPayload, 'iat' | 'exp'> & Record<string, unknown>,
      { secret: env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL_SECONDS },
    );
    return { token, jti, expiresIn: ACCESS_TTL_SECONDS };
  }

  // ── MFA pending tokens ─────────────────────────────────────────────────

  signMfaPending(opts: { userId: string; role: UserRole; email: string }): { token: string; jti: string; expiresIn: number } {
    const jti = randomUUID();
    const token = this.jwt.sign(
      { sub: opts.userId, role: opts.role, email: opts.email, purpose: 'mfa', jti },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: MFA_TTL_SECONDS },
    );
    return { token, jti, expiresIn: MFA_TTL_SECONDS };
  }

  // ── Refresh tokens ─────────────────────────────────────────────────────

  async issueRefresh(opts: {
    userId: string;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.parseTtl(env.JWT_REFRESH_TTL));

    await this.prisma.refreshToken.create({
      data: {
        userId: opts.userId,
        tokenHash,
        expiresAt,
        userAgent: opts.userAgent?.slice(0, 500),
        ipHash: opts.ip ? this.hashIp(opts.ip) : null,
      },
    });
    return { token, expiresAt };
  }

  async rotateRefresh(opts: {
    presentedToken: string;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }): Promise<{
    access: string;
    accessJti: string;
    refresh: string;
    refreshExpiresAt: Date;
    userId: string;
    role: UserRole;
    email: string;
  }> {
    const tokenHash = this.hashToken(opts.presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    // Replay detection.
    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Also blast the user's access tokens out.
      await this.denylist.setUserCutoff(existing.userId, Math.floor(Date.now() / 1000), ACCESS_TTL_SECONDS + 60);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (existing.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');
    if (!existing.user.isActive) throw new UnauthorizedException('Account disabled');

    const issued = await this.issueRefresh({
      userId: existing.userId,
      userAgent: opts.userAgent,
      ip: opts.ip,
    });
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: this.hashToken(issued.token) },
    });

    const access = this.signAccess({
      userId: existing.user.id,
      role: existing.user.role,
      email: existing.user.email,
    });

    return {
      access: access.token,
      accessJti: access.jti,
      refresh: issued.token,
      refreshExpiresAt: issued.expiresAt,
      userId: existing.user.id,
      role: existing.user.role,
      email: existing.user.email,
    };
  }

  async revokeRefresh(presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Denylist helpers ───────────────────────────────────────────────────

  /** Deny a JWT by its jti for the remaining lifetime computed from `exp`. */
  async denyJtiUntil(jti: string, expUnix: number): Promise<void> {
    const remaining = Math.max(0, expUnix - Math.floor(Date.now() / 1000));
    await this.denylist.denyJti(jti, remaining);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashIp(ip: string): string {
    return createHmac('sha256', env.JWT_ACCESS_SECRET).update(ip).digest('hex').slice(0, 32);
  }

  private parseTtl(ttl: string): number {
    const m = /^(\d+)(s|m|h|d)$/.exec(ttl);
    if (!m) throw new Error(`Invalid TTL: ${ttl}`);
    const n = Number(m[1]);
    switch (m[2]) {
      case 's':
        return n * 1000;
      case 'm':
        return n * 60_000;
      case 'h':
        return n * 3_600_000;
      case 'd':
        return n * 86_400_000;
      default:
        throw new Error(`Invalid TTL unit: ${m[2]}`);
    }
  }
}
