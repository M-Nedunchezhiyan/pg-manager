'use client';

import { useId } from 'react';

import { cn } from '@/lib/utils';

/** Gradient badge + house glyph — the "door" cutout reveals the brand gradient, like light spilling from a home. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const gradId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(160 84% 28%)" />
          <stop offset="55%" stopColor="hsl(226 70% 56%)" />
          <stop offset="100%" stopColor="hsl(262 83% 58%)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${gradId})`} />
      <path
        d="M10.5 19.5 L20 10.5 L29.5 19.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="13.5" y="19" width="13" height="10.5" rx="1.5" fill="white" />
      <rect x="18" y="23.5" width="4" height="6" rx="1" fill={`url(#${gradId})`} />
    </svg>
  );
}

/** Full lockup: mark + wordmark. Use `tone="light"` on dark/gradient backdrops. */
export function Logo({
  size = 36,
  tone = 'dark',
  className,
}: {
  size?: number;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className="font-display leading-none tracking-tight" style={{ fontSize: size * 0.5 }}>
        <span className={cn('font-semibold', tone === 'light' ? 'text-white' : 'text-ink')}>PG</span>{' '}
        <span className={cn('font-normal', tone === 'light' ? 'text-white/70' : 'text-muted')}>Manager</span>
      </span>
    </span>
  );
}
