// Self-hosted session token. Signs/verifies a short JWT that we store in an
// httpOnly cookie. Uses `jose` only (Web Crypto) so this module is safe to
// import from BOTH the Edge middleware and Node route handlers — do NOT import
// Prisma or argon2 here (those are Node-only and would break the Edge build).

import { SignJWT, jwtVerify } from 'jose';

// Role kept as a plain union (not the Prisma enum) to keep this Edge-safe.
export type SessionRole = 'OWNER' | 'MANAGER';

export interface SessionPayload {
  sub: string; // User.id (CUID)
  email: string;
  name: string;
  role: SessionRole;
}

const ALG = 'HS256';
export const SESSION_COOKIE = 'pg_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    // Fail loudly rather than signing with an empty/weak key.
    throw new Error('AUTH_SECRET is missing or shorter than 32 chars');
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: (payload.role as SessionRole) ?? 'MANAGER',
    };
  } catch {
    return null;
  }
}
