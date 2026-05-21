-- Sync Supabase auth.users → public.users
-- Run this AFTER the initial Prisma migrate that creates the public.users table.
-- This file is meant to be applied via:  pnpm prisma migrate deploy   on Supabase.

-- 1. Trigger: when a row is inserted into auth.users (signup), create a matching public.users row.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cuid_id text;
begin
  -- Generate a CUID-shaped id. (Prisma normally does this client-side; here we
  -- just need any unique string — pgcrypto's gen_random_uuid is fine for our use.)
  cuid_id := 'c' || replace(gen_random_uuid()::text, '-', '');

  insert into public.users (id, auth_id, email, name, role, is_active, created_at, updated_at)
  values (
    cuid_id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'MANAGER',
    true,
    now(),
    now()
  )
  on conflict (email) do update set auth_id = excluded.auth_id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 2. Trigger: on email change in auth.users, propagate to public.users.
create or replace function public.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where auth_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_update();

-- 3. Backfill: if any auth.users already exist without a matching public.users row, create one.
insert into public.users (id, auth_id, email, name, role, is_active, created_at, updated_at)
select
  'c' || replace(gen_random_uuid()::text, '-', ''),
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  'MANAGER',
  true,
  now(),
  now()
from auth.users au
left join public.users pu on pu.auth_id = au.id
where pu.id is null
on conflict (email) do nothing;
