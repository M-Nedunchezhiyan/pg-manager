'use client';

import { Building2, Home, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname() ?? '/';

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-surface md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Building2 className="h-5 w-5 text-primary-deep" />
        <span className="font-semibold">PG Manager</span>
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
  );
}
