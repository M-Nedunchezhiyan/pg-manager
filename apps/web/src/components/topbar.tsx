'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MobileNav } from './mobile-nav';
import { NotificationBell } from './notification-bell';

import { beginRouteLoading } from '@/lib/loading-store';

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const search = useSearchParams();
  const initialQ = search?.get('q') ?? '';
  const [q, setQ] = useState(initialQ);

  // Keep input synced when navigation changes the q param externally.
  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  const pgMatch = pathname.match(/^\/pg\/([^/]+)/);
  const placeholder = pgMatch ? 'Search residents in this PG…' : 'Search…';
  const enabled = Boolean(pgMatch);

  const go = (value: string) => {
    if (!pgMatch) return;
    const target = `/pg/${pgMatch[1]}/residents${value ? `?q=${encodeURIComponent(value)}` : ''}`;
    beginRouteLoading();
    router.push(target as never);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-surface px-4">
      <div className="flex flex-1 items-center gap-2">
        <MobileNav />
        <div className="flex w-full max-w-md items-center gap-2 rounded-full bg-bg px-3.5 py-1.5 transition focus-within:ring-2 focus-within:ring-primary/25">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                go(q);
              }
            }}
            placeholder={placeholder}
            disabled={!enabled}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>
      <NotificationBell />
    </header>
  );
}
