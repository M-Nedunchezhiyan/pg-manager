'use client';

import { Home, Menu, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/logo';
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
        className="rounded-md p-2 text-text/70 transition hover:bg-primary-soft lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col overflow-hidden rounded-r-2xl bg-primary-deep shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <Logo size={26} tone="light" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-2">
              {navItems.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={{ pathname: item.href }}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition',
                      isActive
                        ? 'bg-brand-gradient font-medium text-primary-foreground shadow-card'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
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
