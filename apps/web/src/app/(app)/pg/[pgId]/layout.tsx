'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { PG_TABS } from '@/lib/pg-nav';
import { cn } from '@/lib/utils';

export default function PgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ pgId: string }>();
  const pathname = usePathname();
  const base = `/pg/${params.pgId}`;

  return (
    <div>
      {/* Below lg the sidebar collapses, so the section nav lives here as a tap-friendly
          card grid. From lg up, the same links live in the sidebar — see components/sidebar.tsx. */}
      <div className="-mt-2 mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:hidden">
        {PG_TABS.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base;
          const isActive = t.slug ? pathname.startsWith(href) : pathname === href;
          return (
            <Link
              key={t.slug}
              href={href as never}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl bg-surface p-3 text-center text-xs shadow-card transition',
                isActive
                  ? 'bg-brand-gradient font-medium text-primary-foreground shadow-elevated'
                  : 'text-muted hover:shadow-elevated hover:text-primary-deep',
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
