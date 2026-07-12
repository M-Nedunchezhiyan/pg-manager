'use client';

import { useGlobalLoading } from '@/lib/loading-store';
import { cn } from '@/lib/utils';

/**
 * The one loading indicator for the whole app — a thin bar at the very top of
 * the viewport that appears for any state-changing API call or route
 * navigation. See loading-store.ts for what drives it.
 */
export function TopLoadingBar() {
  const loading = useGlobalLoading();

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-300',
        loading ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="h-full w-1/3 animate-loading-bar bg-brand-gradient" />
    </div>
  );
}
