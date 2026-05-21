import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { JwtAuthGuard, Public } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe';
import { AuthService } from './auth.service';
import { LoginSchema, TotpCodeSchema } from './auth.dto';
import {
  ACCESS_COOKIE,
  clearAuthCookies,
  clearMfaCookie,
  MFA_PENDING_COOKIE,
  REFRESH_COOKIE,
  setAccessCookie,
  setMfaPendingCookie,
  setRefreshCookie,
  unwrap,
} from './cookies';
import type { JwtPayload } from './jwt.strategy';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const MFA_MAX_AGE_MS = 5 * 60 * 1000;

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
  ) {}

  // ── Step 1: password ──────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.passwordLogin({
      email: body.email,
      password: body.password,
      userAgent: req.headers['user-agent'],
      ip: this.clientIp(req),
    });

    if (result.step === 'authenticated') {
      // Not reachable today (we always require 2FA), but kept for safety.
      setAccessCookie(res, result.access, ACCESS_MAX_AGE_MS);
      setRefreshCookie(res, result.refresh, result.refreshExpiresAt);
      return { step: 'authenticated', user: result.user };
    }

    setMfaPendingCookie(res, result.mfaToken, MFA_MAX_AGE_MS);
    return { step: result.step, mfaTtlSeconds: result.mfaTtlSeconds };
  }

  // ── Step 2a: enroll for first-time users ──────────────────────────────

  @UseGuards(AuthGuard('mfa'))
  @Post('2fa/setup')
  @HttpCode(200)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async setup(@CurrentUser() user: RequestUser & { email: string }) {
    return this.totp.beginEnrollment(user.sub, user.email);
  }

  @UseGuards(AuthGuard('mfa'))
  @Post('2fa/enable')
  @HttpCode(200)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(TotpCodeSchema))
  async enable(
    @Body() body: { code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const mfa = req.user as JwtPayload;
    const result = await this.auth.enrollAndIssue({
      userId: mfa.sub,
      mfaJti: mfa.jti,
      mfaExp: mfa.exp,
      code: body.code,
      userAgent: req.headers['user-agent'],
      ip: this.clientIp(req),
    });
    clearMfaCookie(res);
    setAccessCookie(res, result.access, ACCESS_MAX_AGE_MS);
    setRefreshCookie(res, result.refresh, result.refreshExpiresAt);
    return { step: 'authenticated', user: result.user, backupCodes: result.backupCodes };
  }

  // ── Step 2b: verify TOTP for existing users ───────────────────────────

  @UseGuards(AuthGuard('mfa'))
  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(TotpCodeSchema))
  async verify(
    @Body() body: { code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const mfa = req.user as JwtPayload;
    const result = await this.auth.verifyMfa({
      userId: mfa.sub,
      mfaJti: mfa.jti,
      mfaExp: mfa.exp,
      code: body.code,
      userAgent: req.headers['user-agent'],
      ip: this.clientIp(req),
    });
    clearMfaCookie(res);
    setAccessCookie(res, result.access, ACCESS_MAX_AGE_MS);
    setRefreshCookie(res, result.refresh, result.refreshExpiresAt);
    return { step: 'authenticated', user: result.user };
  }

  // ── Disable 2FA (requires valid session + current TOTP) ───────────────

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(204)
  @UsePipes(new ZodValidationPipe(TotpCodeSchema))
  async disable(@Body() body: { code: string }, @CurrentUser() user: RequestUser) {
    await this.totp.disable(user.sub, body.code);
  }

  // ── Refresh ───────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = unwrap(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!presented) throw new UnauthorizedException('No refresh token');
    const rotated = await this.tokens.rotateRefresh({
      presentedToken: presented,
      userAgent: req.headers['user-agent'],
      ip: this.clientIp(req),
    });
    setAccessCookie(res, rotated.access, ACCESS_MAX_AGE_MS);
    setRefreshCookie(res, rotated.refresh, rotated.refreshExpiresAt);
    return { ok: true };
  }

  // ── Logout: kill access + refresh + mfa, server-side ──────────────────

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Revoke refresh (DB row).
    const refresh = unwrap(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (refresh) await this.tokens.revokeRefresh(refresh);

    // Deny the bearer access token's jti, regardless of where it was presented.
    const accessToken = this.extractAccessToken(req);
    if (accessToken) {
      const decoded = this.tryDecode(accessToken);
      if (decoded?.jti && decoded.exp) await this.tokens.denyJtiUntil(decoded.jti, decoded.exp);
    }

    // Deny any in-flight MFA token too.
    const mfaToken = unwrap(req.cookies?.[MFA_PENDING_COOKIE] as string | undefined);
    if (mfaToken) {
      const decoded = this.tryDecode(mfaToken);
      if (decoded?.jti && decoded.exp) await this.tokens.denyJtiUntil(decoded.jti, decoded.exp);
    }

    clearAuthCookies(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.sub);
  }

  // ── helpers ───────────────────────────────────────────────────────────

  private clientIp(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]?.trim();
    if (Array.isArray(xff)) return xff[0];
    return req.socket.remoteAddress ?? undefined;
  }

  private extractAccessToken(req: Request): string | null {
    const cookie = unwrap(req.cookies?.[ACCESS_COOKIE] as string | undefined);
    if (cookie) return cookie;
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const raw = auth.slice(7);
      return unwrap(raw) ?? raw;
    }
    return null;
  }

  private tryDecode(token: string): { jti?: string; exp?: number } | null {
    // No signature check — caller is just looking up jti/exp for denylist sizing.
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
      return payload as { jti?: string; exp?: number };
    } catch {
      return null;
    }
  }
}
