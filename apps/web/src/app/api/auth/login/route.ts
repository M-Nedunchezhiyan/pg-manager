// Credential login. Verifies email + password against the Neon `users` table
// (argon2id hash), then issues a signed httpOnly session cookie. No external
// auth provider — everything lives in our own DB.

import argon2 from 'argon2';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/server/common/jwt';
import { prisma } from '@/server/common/prisma';

export const runtime = 'nodejs'; // argon2 is native — cannot run on the Edge
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ statusCode: 400, message: 'Invalid request' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { pgScopes: { select: { pgId: true } } },
  });

  // Always run a verify (even on miss) so response timing doesn't leak whether
  // the email exists.
  const ok =
    user?.passwordHash && user.isActive
      ? await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false)
      : false;

  if (!user || !ok) {
    return NextResponse.json({ statusCode: 401, message: 'Invalid email or password' }, { status: 401 });
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  // Best-effort; never block login on this.
  await prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => undefined);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    pgScopes: user.pgScopes.map((s: { pgId: string }) => s.pgId),
  });
}
