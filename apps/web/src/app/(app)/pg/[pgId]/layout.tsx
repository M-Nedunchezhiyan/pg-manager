'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const tabs = [
  { slug: '', label: 'Overview' },
  { slug: 'beds', label: 'Bed Map' },
  { slug: 'rooms', label: 'Rooms' },
  { slug: 'residents', label: 'Residents' },
  { slug: 'rent', label: 'Rent' },
  { slug: 'food', label: 'Food' },
  { slug: 'expenses', label: 'Expenses' },
];

export default function PgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ pgId: string }>();
  const pathname = usePathname();
  const base = `/pg/${params.pgId}`;

  return (
    <div>
      <div className="-mt-2 mb-6 border-b">
        <nav className="flex gap-1">
          {tabs.map((t) => {
            const href = t.slug ? `${base}/${t.slug}` : base;
            const isActive = t.slug ? pathname.startsWith(href) : pathname === href;
            return (
              <Link
                key={t.slug}
                href={href as never}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-sm transition',
                  isActive
                    ? 'border-primary text-primary-deep'
                    : 'border-transparent text-muted hover:text-text',
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
