import axios, { AxiosError } from 'axios';

import { beginMutationLoading, endMutationLoading } from './loading-store';

// API now lives in the same Next.js app under /api/* (Route Handlers).
// Relative baseURL works on Vercel + locally. Auth is a signed httpOnly session
// cookie set by /api/auth/login — the browser sends it automatically.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

// Only state-changing requests drive the global loading indicator — plain
// GETs (background refetches, polling) should stay invisible to the user.
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function isMutating(config?: { method?: string }) {
  return Boolean(config?.method && MUTATING_METHODS.has(config.method.toLowerCase()));
}

api.interceptors.request.use((config) => {
  if (isMutating(config)) beginMutationLoading();
  return config;
});

api.interceptors.response.use(
  (r) => {
    if (isMutating(r.config)) endMutationLoading();
    return r;
  },
  (error: AxiosError) => {
    if (isMutating(error.config)) endMutationLoading();

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const here = window.location.pathname;
      if (!here.startsWith('/login')) {
        window.location.href = `/login?next=${encodeURIComponent(here)}`;
      }
    }
    return Promise.reject(error);
  },
);

export type ApiError = { statusCode: number; message: string; errors?: Record<string, string[]> };

/**
 * Turns any thrown error into a message safe to show a user — never the raw
 * axios/network text ("Request failed with status code 401"). 401s always get
 * a fixed generic line regardless of server payload, so a bug server-side can
 * never leak which field (email vs. password) was wrong.
 */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'Something went wrong. Please check your connection and try again.';
    }
    const { status, data } = err.response;
    if (status === 401) return 'Invalid email or password.';
    if (status >= 500) return 'Something went wrong on our end. Please try again in a moment.';
    return (data as ApiError | undefined)?.message ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

// Note: the session is a 7-day JWT cookie; there's no silent refresh. On expiry
// the next request 401s and the interceptor above bounces the user to /login.
