'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/lib/api';
import {
  getLedger,
  getPGDues,
  recordPayment,
  type LedgerMonth,
  type PaymentMethod,
} from '@/lib/payments';
import { paiseToRupees, rupeesToPaise } from '@/lib/utils';

const STATUS_COLORS: Record<LedgerMonth['status'], string> = {
  PAID: 'bg-primary-soft text-primary-deep',
  PARTIAL: 'bg-warn/20 text-warn',
  DUE: 'bg-primary/20 text-primary-deep',
  OVERDUE: 'bg-danger/15 text-danger',
  UPCOMING: 'bg-muted/20 text-muted',
};

export default function RentPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['pg-dues', pgId],
    queryFn: () => getPGDues(pgId),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Rent Ledger</h1>

      {isLoading ? (
        <div className="py-10 text-center text-muted">Loading…</div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-10 text-center text-muted">
          No active residents.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft/40 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Resident</th>
                <th className="px-4 py-2 font-medium">Due day</th>
                <th className="px-4 py-2 font-medium text-right">Month rent</th>
                <th className="px-4 py-2 font-medium text-right">Paid</th>
                <th className="px-4 py-2 font-medium text-right">Balance</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id} className="border-t hover:bg-primary-soft/20">
                  <td className="px-4 py-2 font-medium">{r.fullName}</td>
                  <td className="px-4 py-2 text-muted">Day {r.dueDayOfMonth}</td>
                  <td className="px-4 py-2 text-right">{paiseToRupees(r.currentMonthDue)}</td>
                  <td className="px-4 py-2 text-right text-primary-deep">{paiseToRupees(r.currentMonthPaid)}</td>
                  <td className={`px-4 py-2 text-right ${r.balance > 0 ? 'text-danger' : 'text-muted'}`}>
                    {paiseToRupees(r.balance)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="rounded-md border px-3 py-1 text-xs hover:bg-primary-soft"
                    >
                      View ledger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <LedgerDrawer residentId={openId} pgId={pgId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function LedgerDrawer({
  residentId,
  pgId,
  onClose,
}: {
  residentId: string;
  pgId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['ledger', residentId],
    queryFn: () => getLedger(residentId),
  });
  const [recordingMonth, setRecordingMonth] = useState<LedgerMonth | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ledger', residentId] });
    qc.invalidateQueries({ queryKey: ['pg-dues', pgId] });
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-text/30">
      <div className="flex h-full w-full max-w-xl flex-col border-l bg-bg shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-base font-semibold">{data?.resident.fullName ?? 'Loading…'}</h2>
            {data && (
              <p className="text-xs text-muted">
                Due day {data.resident.dueDayOfMonth} · Late fee {paiseToRupees(data.lateFeePerDay)}/day
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-muted hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-muted">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Rent</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2 text-right">Late fee</th>
                  <th className="py-2">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(data?.months ?? []).map((m) => {
                  const lateFeeShown = m.status === 'OVERDUE' && m.lateFeeOwed > 0 ? m.lateFeeOwed : m.lateFeePaid;
                  return (
                    <tr key={`${m.year}-${m.month}`} className="border-t">
                      <td className="py-2">
                        {new Date(m.year, m.month - 1).toLocaleString('en-IN', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-2 text-right">{paiseToRupees(m.rentDue)}</td>
                      <td className="py-2 text-right">{paiseToRupees(m.paid)}</td>
                      <td className="py-2 text-right">
                        {lateFeeShown > 0 ? paiseToRupees(lateFeeShown) : '—'}
                      </td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[m.status]}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {m.status !== 'PAID' && m.status !== 'UPCOMING' && (
                          <button
                            type="button"
                            onClick={() => setRecordingMonth(m)}
                            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-deep"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {recordingMonth && (
          <RecordPaymentModal
            residentId={residentId}
            month={recordingMonth}
            onClose={() => setRecordingMonth(null)}
            onSaved={() => {
              setRecordingMonth(null);
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function RecordPaymentModal({
  residentId,
  month,
  onClose,
  onSaved,
}: {
  residentId: string;
  month: LedgerMonth;
  onClose: () => void;
  onSaved: () => void;
}) {
  const balancePaise = Math.max(0, month.rentDue - month.paid);
  const [amount, setAmount] = useState((balancePaise / 100).toString());
  const [lateFee, setLateFee] = useState(((month.lateFeeOwed - month.lateFeePaid) / 100).toString());
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      recordPayment({
        residentId,
        kind: 'RENT',
        forMonth: month.month,
        forYear: month.year,
        amount: rupeesToPaise(Number(amount)),
        lateFee: rupeesToPaise(Number(lateFee || '0')),
        paidOn,
        method,
        reference: reference || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-text/30 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-bg p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">
            Record rent · {new Date(month.year, month.month - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <Field label="Amount (₹)">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
          </Field>
          <Field label="Late fee (₹)">
            <input type="number" value={lateFee} onChange={(e) => setLateFee(e.target.value)} className={inp} />
          </Field>
          <Field label="Paid on">
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inp} />
          </Field>
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inp}>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Reference">
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={inp} />
          </Field>
          {err && (
            <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              {err}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-surface">
            Cancel
          </button>
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
          >
            {m.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
