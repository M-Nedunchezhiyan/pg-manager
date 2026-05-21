import type { CookieOptions, Response } from 'express';

import { env } from '../../config/env';
import { symDecrypt, symEncrypt, tryDecrypt } from '../../common/crypto/sym-cipher';

export const ACCESS_COOKIE = 'pgm_access';
export const REFRESH_COOKIE = 'pgm_refresh';
export const MFA_PENDING_COOKIE = 'pgm_mfa';

const isProd = env.NODE_ENV === 'production';

function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  };
}

// ── Wrap/unwrap so what's on the wire (and in DevTools) is opaque ──────────

/** Encrypt the JWT/refresh string before sending to the browser. */
export function wrap(value: string): string {
  return symEncrypt(value);
}

/** Decrypt the value before passing to the JWT verifier / refresh lookup. */
export function unwrap(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return symDecrypt(value);
  } catch {
    // tolerate a raw value (e.g. during a key rotation window).
    return tryDecrypt(value);
  }
}

export function setAccessCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(ACCESS_COOKIE, wrap(token), { ...baseCookie(), maxAge: maxAgeMs });
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, wrap(token), {
    ...baseCookie(),
    path: '/api/v1/auth',
    expires: expiresAt,
  });
}

export function setMfaPendingCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(MFA_PENDING_COOKIE, wrap(token), {
    ...baseCookie(),
    path: '/api/v1/auth',
    maxAge: maxAgeMs,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie() });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: '/api/v1/auth' });
  res.clearCookie(MFA_PENDING_COOKIE, { ...baseCookie(), path: '/api/v1/auth' });
}

export function clearMfaCookie(res: Response): void {
  res.clearCookie(MFA_PENDING_COOKIE, { ...baseCookie(), path: '/api/v1/auth' });
}
