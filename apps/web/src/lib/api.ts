import axios, { AxiosError } from 'axios';

// API now lives in the same Next.js app under /api/* (Route Handlers).
// Relative baseURL works on Vercel + locally. Auth is a signed httpOnly session
// cookie set by /api/auth/login — the browser sends it automatically.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
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

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;
    return data?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

// Note: the session is a 7-day JWT cookie; there's no silent refresh. On expiry
// the next request 401s and the interceptor above bounces the user to /login.
