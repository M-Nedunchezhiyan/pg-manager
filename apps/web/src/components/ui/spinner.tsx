'use client';

import { useId } from 'react';

import { cn } from '@/lib/utils';

/** Branded gradient-ring loading symbol — the one loading indicator used everywhere. */
export function Spinner({ size = 28, className }: { size?: number; className?: string }) {
  const gradId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      className={cn('animate-spin', className)}
      role="status"
      aria-label="Loading"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(160 84% 28%)" />
          <stop offset="55%" stopColor="hsl(226 70% 56%)" />
          <stop offset="100%" stopColor="hsl(262 83% 58%)" />
        </linearGradient>
      </defs>
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="88 40"
      />
    </svg>
  );
}

/** Centers the spinner within its container — use for a section/page's loading state. */
export function PageLoader({
  label,
  fullScreen = false,
  className,
}: {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-3 py-10',
        fullScreen ? 'min-h-screen' : 'min-h-[50vh]',
        className,
      )}
    >
      <Spinner size={40} />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  );
}
