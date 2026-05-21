'use client';

import { Building2, Home, Menu, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-text/70 transition hover:bg-primary-soft md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-text/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-surface shadow-lg">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary-deep" />
                <span className="font-semibold">PG Manager</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted hover:bg-bg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 p-2">
              {navItems.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={{ pathname: item.href }}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
                      isActive
                        ? 'bg-primary-soft text-primary-deep'
                        : 'text-text/80 hover:bg-primary-soft hover:text-primary-deep',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
