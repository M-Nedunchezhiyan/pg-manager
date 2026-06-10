// Self-hosted credential auth. Talks to our own /api/auth/* route handlers,
// which verify the password against the Neon `users` table and set an httpOnly
// session cookie. No external auth provider.

import { api } from './api';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'MANAGER';
  pgScopes: string[];
}

export async function login(email: string, password: string): Promise<{ user: CurrentUser }> {
  const { data } = await api.post<CurrentUser>('/auth/login', { email, password });
  return { user: data };
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function fetchMe(): Promise<CurrentUser> {
  const { data } = await api.get<CurrentUser>('/auth/me');
  return data;
}
