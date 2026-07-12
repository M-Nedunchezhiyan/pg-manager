'use client';

import { AMENITIES } from '@/lib/amenities';
import { cn } from '@/lib/utils';

/** Toggleable chip grid for selecting PG amenities/services (Wi-Fi, washing machine, parking, ...). */
export function AmenityPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const set = new Set(selected);

  const toggle = (key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {AMENITIES.map(({ key, label, icon: Icon }) => {
        const on = set.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-pressed={on}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
              on
                ? 'border-transparent bg-brand-gradient text-primary-foreground shadow-card'
                : 'bg-bg text-text/70 hover:border-primary hover:text-primary-deep',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
