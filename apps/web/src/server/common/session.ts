// Resolves the current authenticated app User from the request's session
// cookie (a JWT we signed at login). Throws 401 if no/invalid session, 403 if
// the linked User is missing or deactivated.
//
// The JWT carries the User.id; we always re-load the row so role + PG scopes
// are fresh (a revoked manager loses access on their next request, not in 7d).

import { UserRole } from '@pg/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { SESSION_COOKIE, verifySession } from '@/server/common/jwt';
import { prisma } from '@/server/common/prisma';

export interface AppUser {
  sub: string; // App-level User.id (CUID)
  email: string;
  name: string;
  role: UserRole;
  pgScopes: string[];
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<AppUser> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) throw new HttpError(401, 'Not authenticated');

  const appUser = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { pgScopes: { select: { pgId: true } } },
  });

  if (!appUser || !appUser.isActive) {
    throw new HttpError(403, 'Account is not active');
  }

  return {
    sub: appUser.id,
    email: appUser.email,
    name: appUser.name,
    role: appUser.role,
    pgScopes: appUser.pgScopes.map((s: { pgId: string }) => s.pgId),
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ statusCode: err.status, message: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[api]', message, err);
  return NextResponse.json({ statusCode: 500, message: 'Internal server error' }, { status: 500 });
}
