'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { errorMessage } from '@/lib/api';
import { getBedMap, updateBed, type BedStatus } from '@/lib/rooms';
import { cn, paiseToRupees } from '@/lib/utils';
import { useState } from 'react';

const STATUS_STYLES: Record<BedStatus, { bg: string; ring: string; label: string }> = {
  VACANT: { bg: 'bg-primary-soft', ring: 'ring-primary/30', label: 'Vacant' },
  OCCUPIED: { bg: 'bg-danger/15', ring: 'ring-danger/40', label: 'Occupied' },
  NOTICE_PERIOD: { bg: 'bg-warn/20', ring: 'ring-warn/40', label: 'Notice' },
  BLOCKED: { bg: 'bg-muted/20', ring: 'ring-muted/30', label: 'Blocked' },
};

export default function BedMapPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['bed-map', pgId],
    queryFn: () => getBedMap(pgId),
  });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BedStatus }) => updateBed(id, { status }),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ['bed-map', pgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', pgId] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  if (isLoading || !data) return <div className="text-muted">Loading…</div>;

  const totals = data.reduce(
    (acc, f) => {
      for (const r of f.rooms) {
        for (const b of r.beds) {
          acc.total++;
          if (b.status === 'OCCUPIED') acc.occupied++;
          if (b.status === 'VACANT') acc.vacant++;
        }
      }
      return acc;
    },
    { total: 0, occupied: 0, vacant: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bed Map</h1>
          <p className="text-sm text-muted">
            {totals.occupied} occupied · {totals.vacant} vacant · {totals.total} total
          </p>
        </div>
        <Legend />
      </div>

      {data.length === 0 && (
        <div className="rounded-lg border border-dashed bg-surface p-8 text-center text-muted">
          No floors yet. Set them up in the Rooms tab.
        </div>
      )}

      {err && (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {err}
        </div>
      )}

      <div className="space-y-6">
        {data.map((floor) => (
          <div key={floor.id} className="rounded-lg border bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Floor {floor.number} {floor.name && `· ${floor.name}`}
                </h2>
                <p className="text-xs uppercase tracking-wide text-muted">{floor.allowedGender}</p>
              </div>
            </div>

            {floor.rooms.length === 0 ? (
              <p className="text-sm text-muted">No rooms on this floor.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {floor.rooms.map((room) => (
                  <div key={room.id} className="rounded-md border bg-bg p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Room {room.number}</div>
                        <div className="text-xs text-muted">
                          {room.sharingType.name} ·{' '}
                          {paiseToRupees(room.rentOverride ?? room.sharingType.monthlyRent)}/mo
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {room.beds.map((bed) => {
                        const s = STATUS_STYLES[bed.status];
                        const resident = bed.allocations[0]?.resident;
                        const toggleable = bed.status === 'VACANT' || bed.status === 'BLOCKED';
                        const next: BedStatus = bed.status === 'VACANT' ? 'BLOCKED' : 'VACANT';
                        const title = resident
                          ? `${resident.fullName} · ${s.label}`
                          : toggleable
                            ? `${s.label} — click to mark ${next === 'BLOCKED' ? 'blocked' : 'vacant'}`
                            : s.label;
                        return (
                          <button
                            key={bed.id}
                            type="button"
                            title={title}
                            disabled={!toggleable || toggle.isPending}
                            onClick={() => toggleable && toggle.mutate({ id: bed.id, status: next })}
                            className={cn(
                              'flex h-12 w-12 flex-col items-center justify-center rounded-md ring-1 transition',
                              s.bg,
                              s.ring,
                              toggleable
                                ? 'cursor-pointer hover:ring-2 hover:ring-primary-deep'
                                : 'cursor-default',
                              toggle.isPending && 'opacity-60',
                            )}
                          >
                            <span className="text-sm font-semibold">{bed.label}</span>
                            {resident && (
                              <span className="text-[10px] text-text/70">
                                {resident.fullName.split(' ')[0]?.slice(0, 6)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      {(Object.keys(STATUS_STYLES) as BedStatus[]).map((s) => (
        <div key={s} className="flex items-center gap-1">
          <span className={cn('inline-block h-3 w-3 rounded ring-1', STATUS_STYLES[s].bg, STATUS_STYLES[s].ring)} />
          {STATUS_STYLES[s].label}
        </div>
      ))}
    </div>
  );
}
