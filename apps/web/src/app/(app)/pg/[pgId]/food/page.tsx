'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { errorMessage } from '@/lib/api';
import {
  applyDefaults,
  createFoodGroup,
  createFoodItem,
  deleteFoodGroup,
  deleteFoodItem,
  listFoodGroups,
  listFoodItems,
  listMenus,
  setGroupDefault,
  setMenu,
  type FoodGroup,
  type MealType,
} from '@/lib/food';

const MEALS: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];

export default function FoodPage() {
  const { pgId } = useParams<{ pgId: string }>();
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const itemsQ = useQuery({ queryKey: ['food-items'], queryFn: listFoodItems });
  const groupsQ = useQuery({ queryKey: ['food-groups', pgId], queryFn: () => listFoodGroups(pgId) });
  const menusQ = useQuery({
    queryKey: ['food-menus', pgId, date],
    queryFn: () => listMenus(pgId, date, date),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['food-items'] });
    qc.invalidateQueries({ queryKey: ['food-groups', pgId] });
    qc.invalidateQueries({ queryKey: ['food-menus', pgId, date] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Food</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ItemsCard items={itemsQ.data ?? []} onChange={invalidate} />
        <GroupsCard
          pgId={pgId}
          items={itemsQ.data ?? []}
          groups={groupsQ.data ?? []}
          onChange={invalidate}
        />
      </div>

      <DailyMenuCard
        pgId={pgId}
        date={date}
        onDateChange={setDate}
        groups={groupsQ.data ?? []}
        menus={menusQ.data ?? []}
        onChange={invalidate}
      />
    </div>
  );
}

// ── Items master ──────────────────────────────────────────────────────

function ItemsCard({
  items,
  onChange,
}: {
  items: Array<{ id: string; name: string }>;
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => createFoodItem(name),
    onSuccess: () => {
      setName('');
      setErr(null);
      onChange();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFoodItem(id),
    onSuccess: onChange,
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Items (master)</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Idli, Sambar, Vada…"
          className="flex-1 rounded-md border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!name.trim() || add.isPending}
          className="flex items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
      {err && <p className="mb-2 text-xs text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.id}
            className="group inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs text-primary-deep"
          >
            {it.name}
            <button
              type="button"
              onClick={() => del.mutate(it.id)}
              className="text-primary-deep/60 hover:text-danger"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-muted">No items yet.</span>}
      </div>
    </div>
  );
}

// ── Groups (per PG per meal) ──────────────────────────────────────────

function GroupsCard({
  pgId,
  items,
  groups,
  onChange,
}: {
  pgId: string;
  items: Array<{ id: string; name: string }>;
  groups: FoodGroup[];
  onChange: () => void;
}) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>('BREAKFAST');
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [isDefault, setIsDefault] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () =>
      createFoodGroup({ pgId, name: name.trim(), mealType, itemIds: Array.from(pickedIds), isDefault }),
    onSuccess: () => {
      setName('');
      setPickedIds(new Set());
      setIsDefault(false);
      setErr(null);
      onChange();
    },
    onError: (e) => setErr(errorMessage(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => deleteFoodGroup(id), onSuccess: onChange });
  const mkDefault = useMutation({ mutationFn: (id: string) => setGroupDefault(id), onSuccess: onChange });

  const groupsByMeal = useMemo(() => {
    const map: Record<MealType, FoodGroup[]> = {
      BREAKFAST: [],
      LUNCH: [],
      SNACKS: [],
      DINNER: [],
    };
    for (const g of groups) map[g.mealType].push(g);
    return map;
  }, [groups]);

  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Groups</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && pickedIds.size > 0) add.mutate();
        }}
        className="mb-4 space-y-2 rounded-md border bg-bg p-3"
      >
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name (e.g. South Indian)"
            className="flex-1 rounded-md border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="rounded-md border bg-bg px-3 py-2 text-sm"
          >
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1">
          {items.map((it) => {
            const on = pickedIds.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  const next = new Set(pickedIds);
                  on ? next.delete(it.id) : next.add(it.id);
                  setPickedIds(next);
                }}
                className={`rounded-full px-2 py-0.5 text-xs ring-1 transition ${
                  on
                    ? 'bg-primary text-primary-foreground ring-primary'
                    : 'bg-bg text-text/70 ring-border hover:ring-primary'
                }`}
              >
                {it.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Set as default for {mealType}
          </label>
          <button
            type="submit"
            disabled={!name.trim() || pickedIds.size === 0 || add.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
          >
            Create group
          </button>
        </div>
        {err && <p className="text-xs text-danger">{err}</p>}
      </form>

      {MEALS.map((meal) => (
        <div key={meal} className="mb-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{meal}</div>
          {groupsByMeal[meal].length === 0 ? (
            <p className="text-xs text-muted">No groups.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {groupsByMeal[meal].map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-2 rounded-md bg-bg px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 font-medium">
                      {g.name}
                      {g.isDefault && <Star className="h-3 w-3 fill-warn text-warn" />}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {g.items.map((gi) => gi.item.name).join(' · ')}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!g.isDefault && (
                      <button
                        type="button"
                        onClick={() => mkDefault.mutate(g.id)}
                        className="rounded-md border px-2 py-0.5 text-xs hover:bg-primary-soft"
                      >
                        Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => del.mutate(g.id)}
                      className="rounded-md p-1 text-muted hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Daily menu ────────────────────────────────────────────────────────

function DailyMenuCard({
  pgId,
  date,
  onDateChange,
  groups,
  menus,
  onChange,
}: {
  pgId: string;
  date: string;
  onDateChange: (d: string) => void;
  groups: FoodGroup[];
  menus: Array<{
    date: string;
    mealType: MealType;
    groupId: string | null;
    group: FoodGroup | null;
    items: Array<{ item: { id: string; name: string } }>;
  }>;
  onChange: () => void;
}) {
  const set = useMutation({
    mutationFn: ({ mealType, groupId }: { mealType: MealType; groupId: string | null }) =>
      setMenu({ pgId, date, mealType, groupId }),
    onSuccess: onChange,
  });
  const defaults = useMutation({
    mutationFn: () => applyDefaults(pgId, date),
    onSuccess: onChange,
  });

  return (
    <div className="rounded-lg border bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Daily Menu</h2>
          <p className="text-xs text-muted">Pick a group per meal — or apply defaults.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-md border bg-bg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => defaults.mutate()}
            className="rounded-md border px-3 py-2 text-sm hover:bg-primary-soft"
          >
            Apply defaults
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {MEALS.map((meal) => {
          const menu = menus.find((m) => m.mealType === meal);
          const groupsForMeal = groups.filter((g) => g.mealType === meal);
          const itemsShown = menu?.group?.items.map((gi) => gi.item.name) ?? menu?.items.map((mi) => mi.item.name) ?? [];
          return (
            <div key={meal} className="rounded-md border bg-bg p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{meal}</div>
              <select
                value={menu?.groupId ?? ''}
                onChange={(e) => set.mutate({ mealType: meal, groupId: e.target.value || null })}
                className="mb-2 w-full rounded-md border bg-bg px-2 py-1.5 text-sm"
              >
                <option value="">— none —</option>
                {groupsForMeal.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.isDefault ? ' ★' : ''}
                  </option>
                ))}
              </select>
              <div className="min-h-[2rem] text-xs text-muted">
                {itemsShown.length > 0 ? itemsShown.join(' · ') : 'No menu set.'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
