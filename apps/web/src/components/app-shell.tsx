'use client';

import { usePathname } from 'next/navigation';

import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

// The resident-onboarding wizard gets the full width and no persistent nav —
// a focused, full-bleed flow like a checkout wizard, not a browsing screen.
const NO_SIDEBAR_PATTERN = /\/residents\/onboard(\/|$)/;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const hideSidebar = NO_SIDEBAR_PATTERN.test(pathname);

  return (
    <div className="flex h-screen gap-3 overflow-hidden bg-bg p-2 sm:p-3">
      {!hideSidebar && <Sidebar />}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
