'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { beginRouteLoading, endRouteLoading } from '@/lib/loading-store';

// Safety net: if a click looked like navigation but nothing actually
// happened (same route, cancelled nav, popup blocked, etc.) don't leave the
// loading bar stuck on forever.
const ROUTE_LOADING_TIMEOUT_MS = 4000;

function isInternalNavigationClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;

  const anchor = (e.target as HTMLElement | null)?.closest?.('a');
  if (!anchor) return false;
  if (anchor.hasAttribute('download') || anchor.target === '_blank') return false;

  const href = anchor.getAttribute('href') ?? '';
  if (!href || href.startsWith('#') || /^(mailto|tel):/.test(href)) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;

  return true;
}

function RouteSettledWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Once the new route has actually rendered, the navigation is over.
  useEffect(() => {
    endRouteLoading();
  }, [pathname, searchParams]);

  return null;
}

/**
 * Mounted once near the root. Watches for clicks on in-app links to start the
 * global loading bar immediately (before Next.js finishes the transition),
 * and clears it once the pathname/search params settle on the new route.
 */
export function RouteLoadingListener() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!isInternalNavigationClick(e)) return;
      beginRouteLoading();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => endRouteLoading(), ROUTE_LOADING_TIMEOUT_MS);
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <Suspense fallback={null}>
      <RouteSettledWatcher />
    </Suspense>
  );
}
