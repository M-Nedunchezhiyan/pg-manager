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

// A JWT is signed, not encrypted — anyone holding the cookie can base64-decode
// the payload (e.g. paste it into jwt.io) and read it, even though they can't
// forge a new one without AUTH_SECRET. So the wire claim carries an opaque id
// instead of a human-readable "role":"OWNER" flag — this isn't the security
// boundary (the HMAC signature + httpOnly/secure cookie flags are), it just
// avoids handing a casual cookie-reader an obvious "this one's high-value" tell.
const ROLE_TO_RID: Record<SessionRole, string> = {
  OWNER: 'k9f2x7',
  MANAGER: 'p4m8q1',
};
const RID_TO_ROLE: Record<string, SessionRole> = Object.fromEntries(
  Object.entries(ROLE_TO_RID).map(([role, rid]) => [rid, role as SessionRole]),
);

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
  return new SignJWT({ email: payload.email, name: payload.name, rid: ROLE_TO_RID[payload.role] })
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
      // Falls back to the least-privileged role for a missing/unrecognized rid
      // (e.g. a pre-existing session signed before this change) — same
      // fail-toward-least-privilege default this code already used for `role`.
      role: RID_TO_ROLE[String(payload.rid ?? '')] ?? 'MANAGER',
    };
  } catch {
    return null;
  }
}
