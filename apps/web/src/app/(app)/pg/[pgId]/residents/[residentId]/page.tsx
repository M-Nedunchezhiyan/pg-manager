'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, LogOut, Pencil, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/lib/api';
import {
  cancelResidentNotice,
  getResident,
  giveResidentNotice,
  relieveResident,
  updateResident,
  type ResidentDetail,
  type UpdateResidentInput,
} from '@/lib/residents';
import { paiseToRupees, rupeesToPaise } from '@/lib/utils';

export default function ResidentDetailPage() {
  const { pgId, residentId } = useParams<{ pgId: string; residentId: string }>();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['resident', residentId],
    queryFn: () => getResident(residentId),
  });

  const [noticeOpen, setNoticeOpen] = useState(false);
  const [relieveOpen, setRelieveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['resident', residentId] });
    qc.invalidateQueries({ queryKey: ['residents', pgId] });
    qc.invalidateQueries({ queryKey: ['bed-map', pgId] });
    qc.invalidateQueries({ queryKey: ['pg-dues', pgId] });
  };

  if (isLoading || !data) {
    return <div className="text-muted">Loading…</div>;
  }

  const currentAlloc = data.allocations.find((a) => a.toDate === null);
  const totalAdvance = data.advances.reduce((s, a) => s + a.amount, 0);
  const totalRefunded = data.advances.reduce((s, a) => s + a.refundedAmount, 0);

  return (
    <div className="space-y-6">
      <Link
        href={`/pg/${pgId}/residents` as never}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" /> Back to residents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt={data.fullName} className="h-16 w-16 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-xl font-semibold text-primary-deep">
              {data.fullName[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{data.fullName}</h1>
            <p className="text-sm text-muted">
              <StatusPill status={data.status} /> · Joined{' '}
              {new Date(data.joinedOn).toLocaleDateString('en-IN')} · Due day {data.dueDayOfMonth}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data.status !== 'INACTIVE' && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-primary-soft"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {data.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => setNoticeOpen(true)}
              className="rounded-md border px-3 py-2 text-sm hover:bg-primary-soft"
            >
              Give notice
            </button>
          )}
          {data.status === 'NOTICE' && <CancelNoticeButton residentId={data.id} onDone={refresh} />}
          {data.status !== 'INACTIVE' && (
            <button
              type="button"
              onClick={() => setRelieveOpen(true)}
              className="flex items-center gap-1 rounded-md bg-danger px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <LogOut className="h-4 w-4" />
              Relieve
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Contact">
          <Row k="Primary contact" v={data.primaryContactName} />
          <Row k="Email" v={data.email ?? '—'} />
          <Row k="With food" v={data.withFood ? 'Yes' : 'No'} />
        </Card>
        <Card title="Work / Institution">
          <Row k="Work" v={data.workOrInstitution} />
          {data.workAddress && <Row k="Address" v={data.workAddress} />}
        </Card>
        <Card title="Home">
          <Row k="Address" v={data.homeAddress} />
          <Row k="City / State" v={`${data.homeCity}, ${data.homeState}`} />
        </Card>
        <Card title="ID proof">
          <Row k="Type" v={data.idProofType ?? '—'} />
          {data.idProofUrl ? (
            <a
              href={data.idProofUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary-deep hover:underline"
            >
              <FileText className="h-3 w-3" /> Open ID image
            </a>
          ) : (
            <p className="text-sm text-muted">No image on file.</p>
          )}
        </Card>
      </div>

      {currentAlloc && (
        <Card title="Current allocation">
          <Row
            k="Bed"
            v={`Floor ${currentAlloc.bed.room.floor.number} · Room ${currentAlloc.bed.room.number} · Bed ${currentAlloc.bed.label}`}
          />
          <Row k="Rent" v={paiseToRupees(currentAlloc.rentSnapshot)} />
          <Row k="From" v={new Date(currentAlloc.fromDate).toLocaleDateString('en-IN')} />
        </Card>
      )}

      <Card title={`Allocation history (${data.allocations.length})`}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Bed</th>
              <th className="py-2">From</th>
              <th className="py-2">To</th>
              <th className="py-2 text-right">Rent</th>
            </tr>
          </thead>
          <tbody>
            {data.allocations.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2">
                  F{a.bed.room.floor.number} · {a.bed.room.number} / {a.bed.label}
                </td>
                <td className="py-2 text-muted">{new Date(a.fromDate).toLocaleDateString('en-IN')}</td>
                <td className="py-2 text-muted">
                  {a.toDate ? new Date(a.toDate).toLocaleDateString('en-IN') : '— current —'}
                </td>
                <td className="py-2 text-right">{paiseToRupees(a.rentSnapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title={`Payments (${data.payments.length}) · Advance held: ${paiseToRupees(totalAdvance - totalRefunded)}`}
      >
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Kind</th>
              <th className="py-2">For</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 text-right">Late fee</th>
              <th className="py-2">Method</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2 text-muted">{new Date(p.paidOn).toLocaleDateString('en-IN')}</td>
                <td className="py-2 font-medium">{p.kind}</td>
                <td className="py-2 text-muted">
                  {p.forMonth && p.forYear
                    ? new Date(p.forYear, p.forMonth - 1).toLocaleString('en-IN', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="py-2 text-right">{paiseToRupees(p.amount)}</td>
                <td className="py-2 text-right">{p.lateFee > 0 ? paiseToRupees(p.lateFee) : '—'}</td>
                <td className="py-2 text-muted">{p.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editOpen && (
        <EditResidentModal
          resident={data}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}
      {noticeOpen && (
        <NoticeModal
          resident={data}
          onClose={() => setNoticeOpen(false)}
          onSaved={() => {
            setNoticeOpen(false);
            refresh();
          }}
        />
      )}
      {relieveOpen && (
        <RelieveModal
          resident={data}
          onClose={() => setRelieveOpen(false)}
          onSaved={() => {
            setRelieveOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CancelNoticeButton({ residentId, onDone }: { residentId: string; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => cancelResidentNotice(residentId),
    onSuccess: () => {
      setErr(null);
      onDone();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={m.isPending}
        onClick={() => m.mutate()}
        className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-primary-soft disabled:opacity-60"
      >
        {m.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        Cancel notice
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}

function EditResidentModal({
  resident,
  onClose,
  onSaved,
}: {
  resident: ResidentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UpdateResidentInput>({
    fullName: resident.fullName,
    email: resident.email ?? '',
    homeAddress: resident.homeAddress,
    homeCity: resident.homeCity,
    homeState: resident.homeState,
    primaryContactName: resident.primaryContactName,
    workOrInstitution: resident.workOrInstitution,
    workAddress: resident.workAddress ?? '',
    withFood: resident.withFood,
  });
  const [phone, setPhone] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof UpdateResidentInput>(k: K, v: UpdateResidentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const m = useMutation({
    mutationFn: () => {
      // Strip empty-string optionals — they'd fail email/phone regex on the server.
      const payload: UpdateResidentInput = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === '' || v === undefined) continue;
        (payload as Record<string, unknown>)[k] = v;
      }
      if (phone.trim()) payload.phone = phone.trim();
      if (primaryContactPhone.trim()) payload.primaryContactPhone = primaryContactPhone.trim();
      return updateResident(resident.id, payload);
    },
    onSuccess: onSaved,
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <Modal title="Edit resident" onClose={onClose} size="lg">
      <p className="mb-2 text-xs text-muted">
        Phone fields are encrypted; leave blank to keep the existing value.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Full name">
          <input value={form.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} className={inp} />
        </Field>
        <Field label="Email">
          <input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className={inp} type="email" />
        </Field>
        <Field label="New phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} inputMode="tel" placeholder="Unchanged" />
        </Field>
        <Field label="New primary contact phone (optional)">
          <input value={primaryContactPhone} onChange={(e) => setPrimaryContactPhone(e.target.value)} className={inp} inputMode="tel" placeholder="Unchanged" />
        </Field>
        <Field label="Primary contact name">
          <input value={form.primaryContactName ?? ''} onChange={(e) => set('primaryContactName', e.target.value)} className={inp} />
        </Field>
        <Field label="Work / institution">
          <input value={form.workOrInstitution ?? ''} onChange={(e) => set('workOrInstitution', e.target.value)} className={inp} />
        </Field>
        <Field label="Work address">
          <input value={form.workAddress ?? ''} onChange={(e) => set('workAddress', e.target.value)} className={inp} />
        </Field>
        <Field label="Home city">
          <input value={form.homeCity ?? ''} onChange={(e) => set('homeCity', e.target.value)} className={inp} />
        </Field>
        <Field label="Home state">
          <input value={form.homeState ?? ''} onChange={(e) => set('homeState', e.target.value)} className={inp} />
        </Field>
        <Field label="With food">
          <select
            value={form.withFood ? 'true' : 'false'}
            onChange={(e) => set('withFood', e.target.value === 'true')}
            className={inp}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Home address">
            <textarea
              value={form.homeAddress ?? ''}
              onChange={(e) => set('homeAddress', e.target.value)}
              rows={2}
              className={inp}
            />
          </Field>
        </div>
      </div>
      {err && <Err msg={err} />}
      <ModalActions onCancel={onClose} onSubmit={() => m.mutate()} busy={m.isPending} />
    </Modal>
  );
}

function NoticeModal({
  resident,
  onClose,
  onSaved,
}: {
  resident: ResidentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      giveResidentNotice(resident.id, {
        ...(date && { expectedLeavingOn: date }),
        ...(note && { note }),
      }),
    onSuccess: onSaved,
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <Modal title="Give notice" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        Sets status to NOTICE and marks the bed as notice-period. Leave date blank to use the PG's notice
        period setting.
      </p>
      <Field label="Expected leaving date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
      </Field>
      <Field label="Note">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} />
      </Field>
      {err && <Err msg={err} />}
      <ModalActions onCancel={onClose} onSubmit={() => m.mutate()} busy={m.isPending} />
    </Modal>
  );
}

function RelieveModal({
  resident,
  onClose,
  onSaved,
}: {
  resident: ResidentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const totalAdvance = resident.advances.reduce((s, a) => s + a.amount, 0);
  const totalRefunded = resident.advances.reduce((s, a) => s + a.refundedAmount, 0);
  const held = Math.max(0, totalAdvance - totalRefunded);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [damages, setDamages] = useState('0');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const refundable = Math.max(0, held - rupeesToPaise(Number(damages || '0')));

  const m = useMutation({
    mutationFn: () =>
      relieveResident(resident.id, {
        actualLeavingOn: date,
        damagesAmount: rupeesToPaise(Number(damages || '0')),
        ...(notes && { notes }),
      }),
    onSuccess: onSaved,
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <Modal title="Relieve resident" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        Closes active allocations, frees the bed, and refunds the held advance minus any damages.
      </p>
      <Field label="Leaving date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
      </Field>
      <Field label="Damages to deduct (₹)">
        <input type="number" value={damages} onChange={(e) => setDamages(e.target.value)} className={inp} />
      </Field>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} rows={2} />
      </Field>
      <div className="mt-3 rounded-md border bg-primary-soft/40 px-3 py-2 text-sm">
        <div className="flex justify-between"><span className="text-muted">Advance held</span><span>{paiseToRupees(held)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Damages</span><span>-{paiseToRupees(rupeesToPaise(Number(damages || '0')))}</span></div>
        <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
          <span>Refundable</span><span className="text-primary-deep">{paiseToRupees(refundable)}</span>
        </div>
      </div>
      {err && <Err msg={err} />}
      <ModalActions onCancel={onClose} onSubmit={() => m.mutate()} busy={m.isPending} submitLabel="Relieve" danger />
    </Modal>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

const inp = 'w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';

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

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'ACTIVE'
      ? 'bg-primary-soft text-primary-deep'
      : status === 'NOTICE'
        ? 'bg-warn/20 text-warn'
        : 'bg-muted/20 text-muted';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

function Modal({
  title,
  onClose,
  children,
  size = 'sm',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'lg';
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4">
      <div className={`w-full ${size === 'lg' ? 'max-w-2xl' : 'max-w-md'} rounded-lg border bg-bg p-5 shadow-card`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
      {msg}
    </div>
  );
}

function ModalActions({
  onCancel,
  onSubmit,
  busy,
  submitLabel,
  danger,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel?: string;
  danger?: boolean;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button onClick={onCancel} className="rounded-md border px-3 py-2 text-sm hover:bg-surface">
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={busy}
        className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 ${
          danger ? 'bg-danger' : 'bg-primary hover:bg-primary-deep'
        }`}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        {submitLabel ?? 'Save'}
      </button>
    </div>
  );
}

