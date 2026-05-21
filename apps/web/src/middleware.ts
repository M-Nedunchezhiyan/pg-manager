import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Public paths — these don't require an active session.
const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback', '/_next', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // The Supabase SSR client refreshes the session cookie if it's near expiry.
  // We need to thread response cookies through to the eventual response.
  let response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api/cron|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
