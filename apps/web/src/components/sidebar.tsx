'use client';

import { Home, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '@/components/logo';
import { PG_TABS } from '@/lib/pg-nav';
import { cn } from '@/lib/utils';

function navLinkCls(isActive: boolean) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
    isActive
      ? 'bg-brand-gradient font-medium text-primary-foreground shadow-card'
      : 'text-white/70 hover:bg-white/10 hover:text-white',
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  const pgMatch = pathname.match(/^\/pg\/([^/]+)/);
  const base = pgMatch ? `/pg/${pgMatch[1]}` : null;

  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-hidden rounded-2xl bg-primary-deep shadow-card lg:flex">
      <div className="flex h-14 items-center border-b border-white/10 px-4">
        <Logo size={28} tone="light" />
      </div>
      <nav className="flex flex-1 flex-col space-y-1 overflow-y-auto p-2">
        <Link href={{ pathname: '/' }} className={navLinkCls(pathname === '/')}>
          <Home className="h-4 w-4" />
          Home
        </Link>

        {base && (
          <>
            {/* <div className="mb-1 mt-3 px-3 text-[10px] font-bold uppercase tracking-wider text-white/90">
              This PG
            </div> */}
            {PG_TABS.map((t) => {
              const href = t.slug ? `${base}/${t.slug}` : base;
              const isActive = t.slug ? pathname.startsWith(href) : pathname === href;
              return (
                <Link key={t.slug} href={href as never} className={navLinkCls(isActive)}>
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </>
        )}

        <div className="mt-auto pt-2">
          <Link href={{ pathname: '/settings' }} className={navLinkCls(pathname.startsWith('/settings'))}>
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </nav>
    </aside>
  );
}
