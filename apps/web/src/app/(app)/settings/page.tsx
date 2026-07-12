'use client';

import { useQuery } from '@tanstack/react-query';
import { LogOut, ShieldCheck, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PageLoader } from '@/components/ui/spinner';
import { fetchMe, logout } from '@/lib/auth';
import { beginRouteLoading } from '@/lib/loading-store';

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Settings</p>
        <h1 className="font-display text-2xl font-medium">Settings</h1>
      </div>

      {isLoading || !me ? (
        <PageLoader className="min-h-[16rem]" />
      ) : (
        <>
          <Card title="Account" icon={UserCircle}>
            <Row k="Name" v={me.name} />
            <Row k="Email" v={me.email} />
            <Row k="Role" v={me.role} />
            <Row k="PGs you can access" v={me.role === 'OWNER' ? 'All (owner)' : `${me.pgScopes.length}`} />
            <div className="mt-4">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  beginRouteLoading();
                  router.replace('/login');
                }}
                className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-surface"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </Card>

          <Card title="Security" icon={ShieldCheck}>
            <div className="flex items-start gap-3 text-sm">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-deep" />
              <div>
                <p>
                  Sign-in uses a password stored securely (argon2-hashed) in our own database.
                  Your session is a signed, httpOnly cookie that expires after 7 days.
                </p>
                <p className="mt-2 text-xs text-muted">
                  To change the password, re-run the owner seed with a new
                  SEED_OWNER_PASSWORD. A self-service password-change screen is planned.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Card({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-card transition hover:shadow-elevated">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary-deep" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="break-all text-right font-medium">{v}</dd>
    </div>
  );
}
