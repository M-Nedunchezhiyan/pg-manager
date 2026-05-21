import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Money helpers — store paise, display rupees. */
export const paiseToRupees = (paise: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);
