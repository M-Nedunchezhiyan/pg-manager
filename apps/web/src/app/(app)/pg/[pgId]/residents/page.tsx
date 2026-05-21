'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { listResidents } from '@/lib/residents';

export default function ResidentsPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const initialQ = search?.get('q') ?? '';
  const [q, setQ] = useState(initialQ);

  // Keep input in sync when the user navigates via topbar search.
  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  // Debounce URL updates so typing here doesn't churn history on every keystroke.
  useEffect(() => {
    if (q === initialQ) return;
    const id = setTimeout(() => {
      const target = q ? `/pg/${pgId}/residents?q=${encodeURIComponent(q)}` : `/pg/${pgId}/residents`;
      router.replace(target as never);
    }, 250);
    return () => clearTimeout(id);
  }, [q, initialQ, pgId, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['residents', pgId, q],
    queryFn: () => listResidents(pgId, q || undefined),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Residents</h1>
        <Link
          href={`/pg/${pgId}/residents/onboard` as never}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-deep"
        >
          <Plus className="h-4 w-4" /> Onboard
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-md border bg-bg px-3 py-2">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Search by name, phone, or institution…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted">Loading…</div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-10 text-center text-muted">
          No residents yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft/40 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Bed</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Due day</th>
                <th className="px-4 py-2 font-medium">Food</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => {
                const a = r.allocations?.[0];
                return (
                  <tr key={r.id} className="border-t hover:bg-primary-soft/20">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/pg/${pgId}/residents/${r.id}` as never}
                        className="text-primary-deep hover:underline"
                      >
                        {r.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {a ? `F${a.bed.room.floor.number} · ${a.bed.room.number} / ${a.bed.label}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {new Date(r.joinedOn).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-2 text-muted">{r.dueDayOfMonth}</td>
                    <td className="px-4 py-2 text-muted">{r.withFood ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.status === 'ACTIVE'
                            ? 'bg-primary-soft text-primary-deep'
                            : r.status === 'NOTICE'
                              ? 'bg-warn/20 text-warn'
                              : 'bg-muted/20 text-muted'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
