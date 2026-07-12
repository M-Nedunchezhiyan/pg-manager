'use client';

import { useSyncExternalStore } from 'react';

// Single source of truth for the app's one global loading indicator — driven
// by in-flight mutating API calls (see api.ts) and in-flight route
// navigations (see route-loading-listener.tsx). Kept as a plain module-level
// store rather than context so axios interceptors (outside React) can update
// it directly.
const listeners = new Set<() => void>();
let mutationCount = 0;
let routePending = false;

function emit() {
  listeners.forEach((listener) => listener());
}

export function beginMutationLoading() {
  mutationCount += 1;
  emit();
}

export function endMutationLoading() {
  mutationCount = Math.max(0, mutationCount - 1);
  emit();
}

export function beginRouteLoading() {
  if (routePending) return;
  routePending = true;
  emit();
}

export function endRouteLoading() {
  if (!routePending) return;
  routePending = false;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return mutationCount > 0 || routePending;
}

function getServerSnapshot() {
  return false;
}

/** True while a state-changing API call or a route navigation is in flight. */
export function useGlobalLoading() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
