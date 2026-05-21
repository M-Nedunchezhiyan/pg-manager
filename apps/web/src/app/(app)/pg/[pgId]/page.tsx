'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { api, errorMessage } from '@/lib/api';
import { updatePGSettings } from '@/lib/pgs';
import { paiseToRupees, rupeesToPaise } from '@/lib/utils';

interface PGDetail {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
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

  if (isLoading || !data) return <div className="text-muted">Loading…</div>;
  const s = data.settings;
  const d = dash.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-muted">
          {data.address}, {data.city} {data.pincode}
        </p>
      </div>

      {d && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Stat label="Active residents" value={d.counts.activeResidents} />
            <Stat label="Occupancy" value={`${d.counts.occupancyPercent}%`} sub={`${d.counts.occupied}/${d.counts.totalBeds}`} />
            <Stat
              label="This month revenue"
              value={paiseToRupees(d.thisMonth?.revenue ?? 0)}
              tone="success"
            />
            <Stat
              label="This month expenses"
              value={paiseToRupees(d.thisMonth?.expenses ?? 0)}
              tone="warn"
            />
            <Stat
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


        <Card title="Floors">
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

        <Card title="Sharing types & rent">
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
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
  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
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
            <div className="flex h-3 overflow-hidden rounded bg-bg ring-1 ring-border">
              <div className="bg-primary" style={{ width: `${revPct}%` }} title={`Revenue ${paiseToRupees(m.revenue)}`} />
            </div>
            <div className="flex h-3 overflow-hidden rounded bg-bg ring-1 ring-border">
              <div className="bg-warn" style={{ width: `${expPct}%` }} title={`Expenses ${paiseToRupees(m.expenses)}`} />
            </div>
          </div>
        );
      })}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-primary" /> Revenue
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-warn" /> Expenses
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
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
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
  const [err, setErr] = useState<string | null>(null);

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
    onError: (e) => setErr(errorMessage(e)),
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

      {err && (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {err}
        </div>
      )}

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
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
        >
          {m.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </form>
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
