'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { PageLoader } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast-store';
import { errorMessage } from '@/lib/api';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  type ExpenseCategory,
} from '@/lib/expenses';
import { paiseToRupees, rupeesToPaise } from '@/lib/utils';

const CATEGORIES: ExpenseCategory[] = [
  'ELECTRICITY',
  'WATER',
  'GAS',
  'INTERNET',
  'SALARY',
  'GROCERY',
  'REPAIR',
  'MAINTENANCE',
  'RENT',
  'TAX',
  'OTHER',
];

export default function ExpensesPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const qc = useQueryClient();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(lastOfMonth);

  const q = useQuery({
    queryKey: ['expenses', pgId, from, to],
    queryFn: () => listExpenses(pgId, from, to),
  });

  const total = useMemo(() => (q.data ?? []).reduce((s, e) => s + e.amount, 0), [q.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['expenses', pgId, from, to] });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">Expenses</p>
          <h1 className="font-display text-2xl font-medium">Expenses</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-2 rounded-md border bg-bg px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-2 rounded-md border bg-bg px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      <NewExpense pgId={pgId} onSaved={refresh} />

      <div className="rounded-xl bg-surface p-4 shadow-card transition hover:shadow-elevated">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted">
            <ReceiptText className="h-3.5 w-3.5 text-primary-deep" />
            In range
          </span>
          <span className="text-sm">
            Total: <span className="font-semibold">{paiseToRupees(total)}</span>
          </span>
        </div>
        {q.isLoading ? (
          <PageLoader className="min-h-[10rem] py-4" />
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No expenses recorded for this range.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Category</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2">Note</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {q.data!.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-2 text-muted">{new Date(e.spentOn).toLocaleDateString('en-IN')}</td>
                  <td className="py-2">{e.category}</td>
                  <td className="py-2 text-right font-medium">{paiseToRupees(e.amount)}</td>
                  <td className="py-2 text-muted">{e.note ?? '—'}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteExpense(e.id);
                        refresh();
                      }}
                      className="rounded-md p-1 text-muted hover:text-danger"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NewExpense({ pgId, onSaved }: { pgId: string; onSaved: () => void }) {
  const [category, setCategory] = useState<ExpenseCategory>('ELECTRICITY');
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const m = useMutation({
    mutationFn: () =>
      createExpense({
        pgId,
        category,
        amount: rupeesToPaise(Number(amount)),
        spentOn,
        note: note || undefined,
      }),
    onSuccess: () => {
      setAmount('');
      setNote('');
      onSaved();
    },
    onError: (e) =>
      toast({ variant: 'error', title: "Couldn't add expense", description: errorMessage(e) }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (Number(amount) > 0) m.mutate();
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg bg-surface p-3"
    >
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inp}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block w-28">
        <span className="mb-1 block text-xs text-muted">Amount (₹)</span>
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inp}
        />
      </label>
      <label className="block w-40">
        <span className="mb-1 block text-xs text-muted">Date</span>
        <input
          type="date"
          value={spentOn}
          onChange={(e) => setSpentOn(e.target.value)}
          className={`${inp} w-full`}
        />
      </label>
      <label className="block flex-1 min-w-[160px]">
        <span className="mb-1 block text-xs text-muted">Note</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} />
      </label>
      <button
        type="submit"
        disabled={!amount || m.isPending}
        className="flex h-10 items-center gap-1 rounded-md bg-brand-gradient px-3 text-sm font-medium text-primary-foreground shadow-card transition hover:brightness-110 disabled:opacity-60"
      >
        {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add
      </button>
    </form>
  );
}

const inp = 'rounded-md border bg-bg px-3 py-2 text-sm outline-none focus:border-primary';
