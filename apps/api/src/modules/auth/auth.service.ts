import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@pg/db';

import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, needsRehash, verifyPassword } from './argon';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export type LoginStep =
  | { step: 'mfa_required'; mfaToken: string; mfaTtlSeconds: number }
  | { step: 'mfa_setup_required'; mfaToken: string; mfaTtlSeconds: number }
  | {
      step: 'authenticated';
      user: { id: string; email: string; name: string; role: UserRole };
      access: string;
      accessJti: string;
      refresh: string;
      refreshExpiresAt: Date;
    };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
  ) {}

  /**
   * Step 1: password authentication.
   *
   * On success we ALWAYS go through 2FA. If the user has not yet enrolled,
   * we return `mfa_setup_required` and they cannot get a real session until
   * they enroll. This enforces "high-level security login" by default.
   */
  async passwordLogin(opts: {
    email: string;
    password: string;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }): Promise<LoginStep> {
    const user = await this.prisma.user.findUnique({ where: { email: opts.email } });

    // Always run argon2 verify to limit user-enumeration timing.
    const candidateHash =
      user?.passwordHash ??
      '$argon2id$v=19$m=19456,t=2,p=1$dGltaW5nLXNhZmUtZHVtbXkkc2FsdA$dGltaW5nLXNhZmUtZHVtbXktaGFzaC1mb3ItY29uc3RhbnQtdGltZQ';
    const passwordOk = await verifyPassword(candidateHash, opts.password);

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    if (!passwordOk) {
      const failed = user.failedLoginCount + 1;
      const locked = failed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Password OK → reset failure counter, optionally re-hash.
    const updates: { failedLoginCount: number; lockedUntil: Date | null; passwordHash?: string } = {
      failedLoginCount: 0,
      lockedUntil: null,
    };
    if (needsRehash(user.passwordHash)) {
      updates.passwordHash = await hashPassword(opts.password);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: updates });

    // Issue MFA-pending token (5 min, /api/v1/auth scope).
    const mfa = this.tokens.signMfaPending({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    return user.totpEnabled
      ? { step: 'mfa_required', mfaToken: mfa.token, mfaTtlSeconds: mfa.expiresIn }
      : { step: 'mfa_setup_required', mfaToken: mfa.token, mfaTtlSeconds: mfa.expiresIn };
  }

  /**
   * Step 2 (existing 2FA): verify TOTP, mint full session, invalidate the MFA token.
   */
  async verifyMfa(opts: {
    userId: string;
    mfaJti: string;
    mfaExp: number;
    code: string;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }): Promise<Exclude<LoginStep, { step: 'mfa_required' } | { step: 'mfa_setup_required' }>> {
    const user = await this.prisma.user.findUnique({ where: { id: opts.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    if (!user.totpEnabled) throw new UnauthorizedException('2FA not enabled');

    const ok = await this.totp.verifyCodeOrBackup(user.id, opts.code);
    if (!ok) throw new UnauthorizedException('Invalid 2FA code');

    return this.issueSession({ user, userAgent: opts.userAgent, ip: opts.ip, killJti: opts.mfaJti, killExp: opts.mfaExp });
  }

  /**
   * Step 2 (first-time setup): enroll TOTP, then mint full session.
   * Called after /2fa/setup returned the QR — user submits the first valid code.
   */
  async enrollAndIssue(opts: {
    userId: string;
    mfaJti: string;
    mfaExp: number;
    code: string;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }): Promise<{
    step: 'authenticated';
    user: { id: string; email: string; name: string; role: UserRole };
    access: string;
    accessJti: string;
    refresh: string;
    refreshExpiresAt: Date;
    backupCodes: string[];
  }> {
    const { backupCodes } = await this.totp.confirmEnrollment(opts.userId, opts.code);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: opts.userId } });
    const session = await this.issueSession({
      user,
      userAgent: opts.userAgent,
      ip: opts.ip,
      killJti: opts.mfaJti,
      killExp: opts.mfaExp,
    });
    return { ...session, backupCodes };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { pgScopes: { select: { pgId: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      totpEnabled: user.totpEnabled,
      pgScopes: user.pgScopes.map((s) => s.pgId),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async issueSession(opts: {
    user: { id: string; email: string; name: string; role: UserRole };
    userAgent?: string | undefined;
    ip?: string | undefined;
    killJti?: string;
    killExp?: number;
  }) {
    // Invalidate the MFA-pending token so it can't be reused.
    if (opts.killJti && opts.killExp) {
      await this.tokens.denyJtiUntil(opts.killJti, opts.killExp);
    }
    await this.prisma.user.update({
      where: { id: opts.user.id },
      data: { lastLoginAt: new Date() },
    });
    const access = this.tokens.signAccess({
      userId: opts.user.id,
      role: opts.user.role,
      email: opts.user.email,
    });
    const refresh = await this.tokens.issueRefresh({
      userId: opts.user.id,
      userAgent: opts.userAgent,
      ip: opts.ip,
    });
    return {
      step: 'authenticated' as const,
      user: { id: opts.user.id, email: opts.user.email, name: opts.user.name, role: opts.user.role },
      access: access.token,
      accessJti: access.jti,
      refresh: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }
}
