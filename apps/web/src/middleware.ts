import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySession } from '@/server/common/jwt';

// Public paths — these don't require an active session.
const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/icon.svg'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verify the signed session cookie at the edge (jose only — no DB hit here).
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/cron|api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
