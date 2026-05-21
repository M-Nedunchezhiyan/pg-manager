'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/lib/api';
import {
  createFloor,
  createSharingType,
  deleteFloor,
  deleteSharingType,
  listFloors,
  listSharingTypes,
  updateFloor,
  updateSharingType,
  type AllowedGender,
  type Floor,
  type SharingType,
} from '@/lib/floors';
import {
  createRoom,
  deleteRoom,
  listRoomsByPg,
  updateRoom,
} from '@/lib/rooms';
import { paiseToRupees, rupeesToPaise } from '@/lib/utils';

export default function RoomsPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const qc = useQueryClient();
  const floorsQ = useQuery({ queryKey: ['floors', pgId], queryFn: () => listFloors(pgId) });
  const sharingQ = useQuery({ queryKey: ['sharing', pgId], queryFn: () => listSharingTypes(pgId) });
  const roomsQ = useQuery({ queryKey: ['rooms', pgId], queryFn: () => listRoomsByPg(pgId) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['floors', pgId] });
    qc.invalidateQueries({ queryKey: ['sharing', pgId] });
    qc.invalidateQueries({ queryKey: ['rooms', pgId] });
    qc.invalidateQueries({ queryKey: ['bed-map', pgId] });
    qc.invalidateQueries({ queryKey: ['pg', pgId] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rooms & Beds Setup</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FloorsCard pgId={pgId} floors={floorsQ.data ?? []} onChanged={invalidate} />
        <SharingTypesCard pgId={pgId} sharingTypes={sharingQ.data ?? []} onChanged={invalidate} />
      </div>

      <RoomsCard
        pgId={pgId}
        floors={floorsQ.data ?? []}
        sharingTypes={sharingQ.data ?? []}
        rooms={roomsQ.data ?? []}
        onChanged={invalidate}
      />
    </div>
  );
}

// ── Floors ──────────────────────────────────────────────────────────────

function FloorsCard({
  pgId,
  floors,
  onChanged,
}: {
  pgId: string;
  floors: Array<Floor & { _count?: { rooms: number } }>;
  onChanged: () => void;
}) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<AllowedGender>('ANY');
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      createFloor({ pgId, number: Number(number), name: name || undefined, allowedGender: gender }),
    onSuccess: () => {
      setNumber('');
      setName('');
      setGender('ANY');
      setErr(null);
      onChanged();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Floors</h2>
      {floors.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm">
          {floors.map((f) => (
            <FloorRow key={f.id} floor={f} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Input label="Number" type="number" value={number} onChange={setNumber} className="w-20" />
        <Input label="Name (optional)" value={name} onChange={setName} className="w-40" />
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Gender</span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as AllowedGender)}
            className="rounded-md border bg-bg px-3 py-2 text-sm"
          >
            <option value="ANY">Any</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={!number || m.isPending}
          className="flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

function FloorRow({
  floor,
  onChanged,
}: {
  floor: Floor & { _count?: { rooms: number } };
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(String(floor.number));
  const [name, setName] = useState(floor.name ?? '');
  const [gender, setGender] = useState<AllowedGender>(floor.allowedGender);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateFloor(floor.id, {
        number: Number(number),
        name: name || undefined,
        allowedGender: gender,
      }),
    onSuccess: () => {
      setErr(null);
      setEditing(false);
      onChanged();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => deleteFloor(floor.id),
    onSuccess: onChanged,
    onError: (e) => setErr(errorMessage(e)),
  });

  if (editing) {
    return (
      <li className="rounded-md border border-primary/30 bg-bg p-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input label="" value={number} onChange={setNumber} type="number" className="w-16" />
          <Input label="" value={name} onChange={setName} placeholder="Name" className="w-32" />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as AllowedGender)}
            className="rounded-md border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="ANY">Any</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          <IconBtn label="Save" onClick={() => save.mutate()} busy={save.isPending} variant="primary">
            <Check className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Cancel" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between rounded-md hover:bg-bg/60">
      <span>
        Floor {floor.number} {floor.name && `· ${floor.name}`}{' '}
        <span className="text-xs text-muted">({floor.allowedGender})</span>
      </span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted">{floor._count?.rooms ?? 0} rooms</span>
        <IconBtn label="Edit" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Delete" onClick={() => del.mutate()} busy={del.isPending} variant="danger">
          <Trash2 className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
      {err && <span className="ml-2 text-xs text-danger">{err}</span>}
    </li>
  );
}

// ── Sharing types ───────────────────────────────────────────────────────

function SharingTypesCard({
  pgId,
  sharingTypes,
  onChanged,
}: {
  pgId: string;
  sharingTypes: SharingType[];
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [rent, setRent] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      createSharingType({
        pgId,
        name,
        capacity: Number(capacity),
        monthlyRent: rupeesToPaise(Number(rent)),
      }),
    onSuccess: () => {
      setName('');
      setCapacity('');
      setRent('');
      setErr(null);
      onChanged();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Sharing types</h2>
      {sharingTypes.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm">
          {sharingTypes.map((st) => (
            <SharingTypeRow key={st.id} item={st} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Input label="Name" value={name} onChange={setName} className="w-32" placeholder="2-Sharing" />
        <Input label="Capacity" type="number" value={capacity} onChange={setCapacity} className="w-24" />
        <Input label="Rent (₹)" type="number" value={rent} onChange={setRent} className="w-28" />
        <button
          type="submit"
          disabled={!name || !capacity || !rent || m.isPending}
          className="flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

function SharingTypeRow({ item, onChanged }: { item: SharingType; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [capacity, setCapacity] = useState(String(item.capacity));
  const [rent, setRent] = useState(String(item.monthlyRent / 100));
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateSharingType(item.id, {
        name,
        capacity: Number(capacity),
        monthlyRent: rupeesToPaise(Number(rent)),
      }),
    onSuccess: () => {
      setErr(null);
      setEditing(false);
      onChanged();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => deleteSharingType(item.id),
    onSuccess: onChanged,
    onError: (e) => setErr(errorMessage(e)),
  });

  if (editing) {
    return (
      <li className="rounded-md border border-primary/30 bg-bg p-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input label="" value={name} onChange={setName} className="w-32" />
          <Input label="" type="number" value={capacity} onChange={setCapacity} className="w-20" />
          <Input label="" type="number" value={rent} onChange={setRent} className="w-28" />
          <IconBtn label="Save" onClick={() => save.mutate()} busy={save.isPending} variant="primary">
            <Check className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Cancel" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md hover:bg-bg/60">
      <span>
        {item.name} · {item.capacity}-bed
      </span>
      <div className="flex items-center gap-1">
        <span className="font-medium">{paiseToRupees(item.monthlyRent)}</span>
        <IconBtn label="Edit" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Delete" onClick={() => del.mutate()} busy={del.isPending} variant="danger">
          <Trash2 className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
      {err && <span className="ml-2 text-xs text-danger">{err}</span>}
    </li>
  );
}

// ── Rooms ───────────────────────────────────────────────────────────────

type RoomRow = Awaited<ReturnType<typeof listRoomsByPg>>[number];

function RoomsCard({
  floors,
  sharingTypes,
  rooms,
  onChanged,
}: {
  pgId: string;
  floors: Floor[];
  sharingTypes: SharingType[];
  rooms: RoomRow[];
  onChanged: () => void;
}) {
  const [floorId, setFloorId] = useState('');
  const [sharingTypeId, setSharingTypeId] = useState('');
  const [number, setNumber] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => createRoom({ floorId, sharingTypeId, number }),
    onSuccess: () => {
      setNumber('');
      setErr(null);
      onChanged();
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Rooms</h2>
      {rooms.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
          {rooms.map((r) => (
            <RoomRowItem key={r.id} room={r} sharingTypes={sharingTypes} onChanged={onChanged} />
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Floor</span>
          <select
            value={floorId}
            onChange={(e) => setFloorId(e.target.value)}
            className="rounded-md border bg-bg px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                Floor {f.number}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Sharing</span>
          <select
            value={sharingTypeId}
            onChange={(e) => setSharingTypeId(e.target.value)}
            className="rounded-md border bg-bg px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {sharingTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Room #" value={number} onChange={setNumber} className="w-24" />
        <button
          type="submit"
          disabled={!floorId || !sharingTypeId || !number || m.isPending}
          className="flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Add room
        </button>
      </form>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

function RoomRowItem({
  room,
  sharingTypes,
  onChanged,
}: {
  room: RoomRow;
  sharingTypes: SharingType[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(room.number);
  const [sharingTypeId, setSharingTypeId] = useState(room.sharingTypeId);
  const [rentOverride, setRentOverride] = useState(
    room.rentOverride != null ? String(room.rentOverride / 100) : '',
  );
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateRoom(room.id, {
        number,
        sharingTypeId,
        rentOverride: rentOverride === '' ? null : rupeesToPaise(Number(rentOverride)),
      }),
    onSuccess: () => {
      setErr(null);
      setEditing(false);
      onChanged();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => deleteRoom(room.id),
    onSuccess: onChanged,
    onError: (e) => setErr(errorMessage(e)),
  });

  if (editing) {
    return (
      <div className="rounded-md border border-primary/30 bg-bg p-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input label="" value={number} onChange={setNumber} className="w-20" />
          <select
            value={sharingTypeId}
            onChange={(e) => setSharingTypeId(e.target.value)}
            className="rounded-md border bg-bg px-2 py-1.5 text-sm"
          >
            {sharingTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input
            label=""
            type="number"
            value={rentOverride}
            onChange={setRentOverride}
            className="w-28"
            placeholder="Rent ₹ (override)"
          />
          <IconBtn label="Save" onClick={() => save.mutate()} busy={save.isPending} variant="primary">
            <Check className="h-4 w-4" />
          </IconBtn>
          <IconBtn label="Cancel" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded border-b py-1 hover:bg-bg/60">
      <span>
        F{room.floor.number} · Room {room.number}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">
          {room.sharingType.name} · {room.sharingType.capacity} beds
          {room.rentOverride != null && ` · ₹${room.rentOverride / 100}`}
        </span>
        <IconBtn label="Edit" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Delete" onClick={() => del.mutate()} busy={del.isPending} variant="danger">
          <Trash2 className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
      {err && <span className="ml-2 text-xs text-danger">{err}</span>}
    </div>
  );
}

// ── small shared helpers ───────────────────────────────────────────────

function IconBtn({
  label,
  onClick,
  busy,
  variant,
  children,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  variant?: 'primary' | 'danger';
  children: React.ReactNode;
}) {
  const cls =
    variant === 'primary'
      ? 'text-primary-deep hover:bg-primary-soft'
      : variant === 'danger'
        ? 'text-muted hover:bg-danger/10 hover:text-danger'
        : 'text-muted hover:bg-primary-soft hover:text-primary-deep';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-50 ${cls}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-xs text-muted">{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
