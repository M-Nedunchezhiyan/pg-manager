// Bare layout for auth pages — no sidebar/topbar.
// Force dynamic so useSearchParams inside login/signup pages doesn't trip
// the static-prerender / Suspense check.
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
