import { api } from './api';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type PaymentKind = 'RENT' | 'ADVANCE' | 'LATE_FEE' | 'REFUND' | 'ADJUSTMENT';
export type LedgerStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE' | 'UPCOMING';

export interface Payment {
  id: string;
  kind: PaymentKind;
  amount: number;
  lateFee: number;
  forMonth: number | null;
  forYear: number | null;
  method: PaymentMethod;
  paidOn: string;
  reference: string | null;
}

export interface LedgerMonth {
  year: number;
  month: number;
  rentDue: number;
  paid: number;
  lateDays: number;
  lateFeeOwed: number;
  lateFeePaid: number;
  status: LedgerStatus;
}

export interface Ledger {
  resident: { id: string; fullName: string; status: string; dueDayOfMonth: number };
  lateFeePerDay: number;
  months: LedgerMonth[];
}

export async function getLedger(residentId: string): Promise<Ledger> {
  const { data } = await api.get<Ledger>(`/payments/ledger/${residentId}`);
  return data;
}

export async function listPaymentsForResident(residentId: string): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>(`/payments/resident/${residentId}`);
  return data;
}

export interface PGDuesRow {
  id: string;
  fullName: string;
  dueDayOfMonth: number;
  currentMonthDue: number;
  currentMonthPaid: number;
  balance: number;
}

export async function getPGDues(pgId: string): Promise<PGDuesRow[]> {
  const { data } = await api.get<PGDuesRow[]>('/payments/dues', { params: { pgId } });
  return data;
}

export async function recordPayment(input: {
  residentId: string;
  kind: PaymentKind;
  forMonth?: number;
  forYear?: number;
  amount: number;
  lateFee?: number;
  paidOn: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}): Promise<Payment> {
  const { data } = await api.post<Payment>('/payments', input);
  return data;
}
