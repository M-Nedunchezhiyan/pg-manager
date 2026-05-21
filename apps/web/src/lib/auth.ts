// Supabase-backed auth helpers. Replaces the previous custom JWT + Argon2 flow.

import { createClient } from '@/lib/supabase/client';

import { api } from './api';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'MANAGER';
  pgScopes: string[];
}

export async function login(email: string, password: string): Promise<{ user: CurrentUser }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  const me = await fetchMe();
  return { user: me };
}

export async function signup(email: string, password: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(error.message);
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function fetchMe(): Promise<CurrentUser> {
  const { data } = await api.get<CurrentUser>('/auth/me');
  return data;
}
