'use client';

import { useQuery } from '@tanstack/react-query';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { fetchMe, logout } from '@/lib/auth';

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {isLoading || !me ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <>
          <Card title="Account">
            <Row k="Name" v={me.name} />
            <Row k="Email" v={me.email} />
            <Row k="Role" v={me.role} />
            <Row k="PGs you can access" v={me.role === 'OWNER' ? 'All (owner)' : `${me.pgScopes.length}`} />
            <div className="mt-4">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.replace('/login');
                }}
                className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-surface"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </Card>

          <Card title="Security">
            <div className="flex items-start gap-3 text-sm">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-deep" />
              <div>
                <p>
                  Sign-in and password reset are managed by Supabase Auth. To change your password,
                  use the &quot;Forgot password&quot; flow on the sign-in page.
                </p>
                <p className="mt-2 text-xs text-muted">
                  Two-factor authentication can be enabled in your Supabase user profile. We&apos;ll wire
                  it into the app in a future release.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
