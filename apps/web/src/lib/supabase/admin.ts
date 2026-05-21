// Service-role client — bypasses RLS. Use only inside Route Handlers / cron jobs
// where the caller is already authenticated and authorized through app logic.
// NEVER import this from a Client Component or expose it to the browser.

import { createClient } from '@supabase/supabase-js';

let admin: ReturnType<typeof createClient> | null = null;

export function supabaseAdmin() {
  if (admin) return admin;
  admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return admin;
}
