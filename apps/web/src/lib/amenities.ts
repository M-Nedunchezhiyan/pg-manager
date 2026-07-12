import {
  AirVent,
  Camera,
  Car,
  Dumbbell,
  Flame,
  Home,
  Refrigerator,
  Router,
  Shirt,
  ShowerHead,
  Sofa,
  Sparkles,
  Tv,
  UtensilsCrossed,
  Waves,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface AmenityDef {
  key: string;
  label: string;
  icon: LucideIcon;
}

/** Curated catalog of common Indian PG/hostel amenities — pick any subset, or add a custom label. */
export const AMENITIES: AmenityDef[] = [
  { key: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { key: 'washing_machine', label: 'Washing Machine', icon: Shirt },
  { key: 'cctv', label: 'CCTV Security', icon: Camera },
  { key: 'parking', label: 'Parking', icon: Car },
  { key: 'power_backup', label: 'Power Backup', icon: Zap },
  { key: 'ac', label: 'Air Conditioning', icon: AirVent },
  { key: 'food', label: 'Food / Mess', icon: UtensilsCrossed },
  { key: 'housekeeping', label: 'Housekeeping', icon: Sparkles },
  { key: 'hot_water', label: 'Hot Water', icon: ShowerHead },
  { key: 'ro_water', label: 'RO Water', icon: Waves },
  { key: 'fridge', label: 'Fridge', icon: Refrigerator },
  { key: 'tv', label: 'TV / DTH', icon: Tv },
  { key: 'gym', label: 'Gym', icon: Dumbbell },
  { key: 'common_area', label: 'Common Lounge', icon: Sofa },
  { key: 'gas_pipeline', label: 'Piped Gas', icon: Flame },
  { key: 'router', label: 'In-room LAN', icon: Router },
];

const BY_KEY = new Map(AMENITIES.map((a) => [a.key, a]));

/** Resolves a stored amenity string to its catalog entry, or a generic fallback for custom entries. */
export function resolveAmenity(key: string): AmenityDef {
  return BY_KEY.get(key) ?? { key, label: key, icon: Home };
}
