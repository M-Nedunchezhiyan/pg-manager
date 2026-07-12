import type { LucideIcon } from 'lucide-react';
import { BedDouble, DoorOpen, LayoutGrid, Receipt, UtensilsCrossed, Users, Wallet } from 'lucide-react';

export interface PgTab {
  slug: string;
  label: string;
  icon: LucideIcon;
}

/** The PG section nav — shown in the sidebar on large screens, as a card grid below that. */
export const PG_TABS: PgTab[] = [
  { slug: '', label: 'Overview', icon: LayoutGrid },
  { slug: 'beds', label: 'Bed Map', icon: BedDouble },
  { slug: 'rooms', label: 'Rooms', icon: DoorOpen },
  { slug: 'residents', label: 'Residents', icon: Users },
  { slug: 'rent', label: 'Rent', icon: Wallet },
  { slug: 'food', label: 'Food', icon: UtensilsCrossed },
  { slug: 'expenses', label: 'Expenses', icon: Receipt },
];
