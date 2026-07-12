'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble,
  Building2,
  Check,
  Copy,
  IndianRupee,
  KeyRound,
  Loader2,
  Pencil,
  ReceiptText,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { AmenityPicker } from '@/components/amenity-picker';
import { PageLoader } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast-store';
import { resolveAmenity } from '@/lib/amenities';
import { api, errorMessage } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { assignPgManager, getPgManager, removePgManager, type AssignManagerResult } from '@/lib/managers';
import { updatePG, updatePGSettings } from '@/lib/pgs';
import { cn, paiseToRupees, rupeesToPaise } from '@/lib/utils';

interface PGDetail {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  amenities?: string[];
  settings?: {
    advanceMonths: number;
    dueDaysAfterJoin: number;
    lateFeePerDay: number;
    noticeDays: number;
  };
  floors: Array<{ id: string; number: number; name: string | null; allowedGender: string }>;
  sharingTypes: Array<{ id: string; name: string; capacity: number; monthlyRent: number }>;
}

interface DashboardData {
  counts: {
    activeResidents: number;
    totalBeds: number;
    occupied: number;
    vacant: number;
    occupancyPercent: number;
  };
  thisMonth: { revenue: number; expenses: number; net: number } | undefined;
  months: Array<{ year: number; month: number; revenue: number; expenses: number; net: number }>;
}

export default function PGOverviewPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['pg', pgId],
    queryFn: async () => (await api.get<PGDetail>(`/pgs/${pgId}`)).data,
  });
  const dash = useQuery({
    queryKey: ['dashboard', pgId],
    queryFn: async () => (await api.get<DashboardData>(`/dashboard/pg/${pgId}`)).data,
  });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  if (isLoading || !data) return <PageLoader />;
  const s = data.settings;
  const d = dash.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">PG Overview</p>
        <h1 className="font-display text-2xl font-medium">{data.name}</h1>
        <p className="text-sm text-muted">
          {data.address}, {data.city} {data.pincode}
        </p>
      </div>

      {d && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat icon={Users} label="Active residents" value={d.counts.activeResidents} />
            <Stat
              icon={BedDouble}
              label="Occupancy"
              value={`${d.counts.occupancyPercent}%`}
              sub={`${d.counts.occupied}/${d.counts.totalBeds}`}
            />
            <Stat
              icon={TrendingUp}
              label="This month revenue"
              value={paiseToRupees(d.thisMonth?.revenue ?? 0)}
              tone="success"
            />
            <Stat
              icon={ReceiptText}
              label="This month expenses"
              value={paiseToRupees(d.thisMonth?.expenses ?? 0)}
              tone="warn"
            />
            <Stat
              icon={IndianRupee}
              label="Net"
              value={paiseToRupees(d.thisMonth?.net ?? 0)}
              tone={(d.thisMonth?.net ?? 0) >= 0 ? 'success' : 'danger'}
            />
          </div>

          <Card title="Last 6 months — P&L">
            <PLChart months={d.months} />
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SettingsCard pgId={pgId} settings={s} />

        <AmenitiesCard pgId={pgId} amenities={data.amenities ?? []} />

        {me?.role === 'OWNER' && <ManagerCard pgId={pgId} />}

        <Card title="Floors" icon={Building2}>
          {data.floors.length === 0 ? (
            <p className="text-sm text-muted">No floors. Add them in the Rooms tab.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.floors.map((f) => (
                <li key={f.id}>
                  Floor {f.number} {f.name ? `· ${f.name}` : ''}{' '}
                  <span className="text-xs text-muted">({f.allowedGender})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Sharing types & rent" icon={IndianRupee}>
          {data.sharingTypes.length === 0 ? (
            <p className="text-sm text-muted">No sharing types defined yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.sharingTypes.map((st) => (
                <li key={st.id} className="flex justify-between">
                  <span>
                    {st.name} · {st.capacity}-bed
                  </span>
                  <span className="font-medium">{paiseToRupees(st.monthlyRent)} / mo</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary-deep" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'success' | 'warn' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'text-primary-deep'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-text';
  const chip =
    tone === 'success'
      ? 'bg-primary-soft text-primary-deep'
      : tone === 'warn'
        ? 'bg-warn/15 text-warn'
        : tone === 'danger'
          ? 'bg-danger/15 text-danger'
          : 'bg-primary-soft text-primary-deep';
  return (
    <div className="rounded-xl bg-surface p-4 shadow-card transition hover:shadow-elevated">
      <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-full', chip)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function PLChart({ months }: { months: DashboardData['months'] }) {
  // Lightweight CSS bar chart — no chart lib.
  const max = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.expenses)));
  return (
    <div className="space-y-2">
      {months.map((m) => {
        const monthLabel = new Date(m.year, m.month - 1).toLocaleString('en-IN', { month: 'short' });
        const revPct = (m.revenue / max) * 100;
        const expPct = (m.expenses / max) * 100;
        return (
          <div key={`${m.year}-${m.month}`} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{monthLabel}</span>
              <span className={`text-right ${m.net >= 0 ? 'text-primary-deep' : 'text-danger'}`}>
                Net {paiseToRupees(m.net)}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-bg ring-1 ring-border">
              <div
                className="rounded-full bg-brand-gradient transition-all"
                style={{ width: `${revPct}%` }}
                title={`Revenue ${paiseToRupees(m.revenue)}`}
              />
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-bg ring-1 ring-border">
              <div
                className="rounded-full bg-warn/70 transition-all"
                style={{ width: `${expPct}%` }}
                title={`Expenses ${paiseToRupees(m.expenses)}`}
              />
            </div>
          </div>
        );
      })}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-brand-gradient" /> Revenue
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-warn/70" /> Expenses
        </span>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function SettingsCard({
  pgId,
  settings,
}: {
  pgId: string;
  settings: PGDetail['settings'] | undefined;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Settings</h2>
        {settings && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-primary-soft"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {!settings ? (
        <p className="text-sm text-muted">No settings yet.</p>
      ) : editing ? (
        <SettingsForm pgId={pgId} current={settings} onDone={() => setEditing(false)} />
      ) : (
        <dl className="space-y-1 text-sm">
          <Row k="Advance months" v={settings.advanceMonths} />
          <Row k="Due days after join" v={settings.dueDaysAfterJoin} />
          <Row k="Late fee / day" v={paiseToRupees(settings.lateFeePerDay)} />
          <Row k="Notice period (days)" v={settings.noticeDays} />
        </dl>
      )}
    </div>
  );
}

function SettingsForm({
  pgId,
  current,
  onDone,
}: {
  pgId: string;
  current: { advanceMonths: number; dueDaysAfterJoin: number; lateFeePerDay: number; noticeDays: number };
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [advanceMonths, setAdvanceMonths] = useState(String(current.advanceMonths));
  const [dueDaysAfterJoin, setDueDaysAfterJoin] = useState(String(current.dueDaysAfterJoin));
  const [lateFeeRupees, setLateFeeRupees] = useState(String(current.lateFeePerDay / 100));
  const [noticeDays, setNoticeDays] = useState(String(current.noticeDays));

  const m = useMutation({
    mutationFn: () =>
      updatePGSettings(pgId, {
        advanceMonths: Number(advanceMonths),
        dueDaysAfterJoin: Number(dueDaysAfterJoin),
        lateFeePerDay: rupeesToPaise(Number(lateFeeRupees || '0')),
        noticeDays: Number(noticeDays),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pg', pgId] });
      onDone();
    },
    onError: (e) => toast({ variant: 'error', title: "Couldn't save PG settings", description: errorMessage(e) }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="space-y-2 text-sm"
    >
      <NumField label="Advance months" value={advanceMonths} onChange={setAdvanceMonths} min={0} max={12} />
      <NumField label="Due days after join" value={dueDaysAfterJoin} onChange={setDueDaysAfterJoin} min={0} max={28} />
      <NumField label="Late fee per day (₹)" value={lateFeeRupees} onChange={setLateFeeRupees} min={0} />
      <NumField label="Notice period (days)" value={noticeDays} onChange={setNoticeDays} min={0} max={120} />

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-surface"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={m.isPending}
          className="flex items-center gap-1 rounded-md bg-brand-gradient px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-card transition hover:brightness-110 disabled:opacity-60"
        >
          {m.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}

function AmenitiesCard({ pgId, amenities }: { pgId: string; amenities: string[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(amenities);

  const m = useMutation({
    mutationFn: (next: string[]) => updatePG(pgId, { amenities: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pg', pgId] });
      setEditing(false);
    },
    onError: (e) => toast({ variant: 'error', title: "Couldn't save amenities", description: errorMessage(e) }),
  });

  return (
    <div className="rounded-xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted">
          <Sparkles className="h-3.5 w-3.5 text-primary-deep" />
          Amenities &amp; services
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(amenities);
              setEditing(true);
            }}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-primary-soft"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <AmenityPicker selected={draft} onChange={setDraft} />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-surface"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => m.mutate(draft)}
              disabled={m.isPending}
              className="flex items-center gap-1 rounded-md bg-brand-gradient px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-card transition hover:brightness-110 disabled:opacity-60"
            >
              {m.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      ) : amenities.length === 0 ? (
        <p className="text-sm text-muted">No amenities added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {amenities.map((key) => {
            const { label, icon: Icon } = resolveAmenity(key);
            return (
              <span
                key={key}
                className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-deep"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ManagerCard({ pgId }: { pgId: string }) {
  const qc = useQueryClient();
  const [assigning, setAssigning] = useState(false);
  const [justAssigned, setJustAssigned] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const { data: manager, isLoading } = useQuery({
    queryKey: ['pg-manager', pgId],
    queryFn: () => getPgManager(pgId),
  });

  const removeMutation = useMutation({
    mutationFn: () => removePgManager(pgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pg-manager', pgId] });
      setJustAssigned(null);
    },
    onError: (e) => toast({ variant: 'error', title: "Couldn't remove manager", description: errorMessage(e) }),
  });

  return (
    <div className="rounded-xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted">
          <UserCog className="h-3.5 w-3.5 text-primary-deep" />
          Manager
        </h2>
        {!isLoading && !manager && !assigning && (
          <button
            type="button"
            onClick={() => setAssigning(true)}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-primary-soft"
          >
            <Pencil className="h-3 w-3" /> Assign manager
          </button>
        )}
      </div>

      {justAssigned && (
        <TempPasswordBanner
          email={justAssigned.email}
          password={justAssigned.temporaryPassword}
          onDismiss={() => setJustAssigned(null)}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : assigning ? (
        <AssignManagerForm
          pgId={pgId}
          onDone={() => setAssigning(false)}
          onAssigned={(result) => {
            if (result.temporaryPassword) {
              setJustAssigned({ email: result.email, temporaryPassword: result.temporaryPassword });
            } else {
              toast({ variant: 'success', title: 'Manager assigned' });
            }
            setAssigning(false);
          }}
        />
      ) : manager ? (
        <div className="space-y-2 text-sm">
          <Row k="Name" v={manager.name} />
          <Row k="Email" v={manager.email} />
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              {removeMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Remove
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">No manager assigned yet.</p>
      )}
    </div>
  );
}

function AssignManagerForm({
  pgId,
  onDone,
  onAssigned,
}: {
  pgId: string;
  onDone: () => void;
  onAssigned: (result: AssignManagerResult) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const m = useMutation({
    mutationFn: () => assignPgManager(pgId, { name, email }),
    onSuccess: onAssigned,
    onError: (e) => toast({ variant: 'error', title: "Couldn't assign manager", description: errorMessage(e) }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="space-y-2 text-sm"
    >
      <label className="block">
        <span className="mb-1 block text-muted">Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border bg-bg px-2 py-1.5 outline-none focus:border-primary"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-muted">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border bg-bg px-2 py-1.5 outline-none focus:border-primary"
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-surface"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={m.isPending}
          className="flex items-center gap-1 rounded-md bg-brand-gradient px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-card transition hover:brightness-110 disabled:opacity-60"
        >
          {m.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Assign
        </button>
      </div>
    </form>
  );
}

function TempPasswordBanner({
  email,
  password,
  onDismiss,
}: {
  email: string;
  password: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-warn">
        <KeyRound className="h-3.5 w-3.5" />
        Save this password now — it won&apos;t be shown again
      </p>
      <p className="text-xs text-muted">{email}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-surface px-2 py-1 font-mono text-xs">{password}</code>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-surface"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onDismiss} className="text-xs text-muted underline hover:text-text">
          Dismiss
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 rounded-md border bg-bg px-2 py-1 text-right text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
