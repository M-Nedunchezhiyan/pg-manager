// Resolves the current authenticated app User from the request's Supabase
// session cookie. Throws 401 if no session, 403 if no matching app User.
//
// Returns a typed user with role + scoped PG ids — same shape NestJS used.

import { UserRole } from '@pg/db';
import { NextResponse } from 'next/server';

import { prisma } from '@/server/common/prisma';
import { createClient } from '@/lib/supabase/server';

export interface AppUser {
  sub: string;        // App-level User.id (CUID)
  authId: string;     // Supabase auth.users.id (UUID)
  email: string;
  name: string;
  role: UserRole;
  pgScopes: string[];
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<AppUser> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new HttpError(401, 'Not authenticated');

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    include: { pgScopes: { select: { pgId: true } } },
  });

  if (!appUser || !appUser.isActive) {
    throw new HttpError(403, 'No app account linked to this login');
  }

  return {
    sub: appUser.id,
    authId: user.id,
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
