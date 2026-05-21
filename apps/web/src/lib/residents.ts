import { api } from './api';

export interface OnboardResidentInput {
  pgId: string;
  bedId: string;
  fullName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  gender: 'MALE' | 'FEMALE' | 'ANY';
  dob?: string;
  photoUrl?: string;
  idProofType?: 'AADHAAR' | 'PAN' | 'LICENSE' | 'PASSPORT' | 'OTHER';
  idProofNumber?: string;
  idProofUrl?: string;
  homeAddress: string;
  homeCity: string;
  homeState: string;
  primaryContactName: string;
  primaryContactPhone: string;
  workOrInstitution: string;
  workAddress?: string;
  joinedOn: string; // YYYY-MM-DD
  withFood: boolean;
  advanceAmount: number;
  firstMonthRent: number;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
  paymentReference?: string;
}

export interface Resident {
  id: string;
  fullName: string;
  joinedOn: string;
  dueDayOfMonth: number;
  status: 'ACTIVE' | 'NOTICE' | 'INACTIVE';
  withFood: boolean;
  allocations?: Array<{
    id: string;
    bed: { id: string; label: string; room: { number: string; floor: { number: number } } };
  }>;
}

export async function onboardResident(input: OnboardResidentInput): Promise<Resident> {
  const { data } = await api.post<Resident>('/residents/onboard', input);
  return data;
}

export async function listResidents(pgId: string, search?: string): Promise<Resident[]> {
  const { data } = await api.get<Resident[]>('/residents', { params: { pgId, search } });
  return data;
}

export interface ResidentDetail extends Resident {
  email: string | null;
  gender: 'MALE' | 'FEMALE' | 'ANY';
  homeAddress: string;
  homeCity: string;
  homeState: string;
  primaryContactName: string;
  workOrInstitution: string;
  workAddress: string | null;
  photoUrl: string | null;
  idProofUrl: string | null;
  idProofType: string | null;
  noticeGivenOn: string | null;
  expectedLeavingOn: string | null;
  actualLeavingOn: string | null;
  pgId: string;
  payments: Array<{
    id: string;
    kind: string;
    amount: number;
    lateFee: number;
    forMonth: number | null;
    forYear: number | null;
    paidOn: string;
    method: string;
    reference: string | null;
  }>;
  advances: Array<{ id: string; amount: number; monthsCovered: number; refundedAmount: number; paidOn: string }>;
  allocations: Array<{
    id: string;
    fromDate: string;
    toDate: string | null;
    rentSnapshot: number;
    bed: { id: string; label: string; room: { number: string; floor: { number: number } } };
  }>;
}

export async function getResident(id: string): Promise<ResidentDetail> {
  const { data } = await api.get<ResidentDetail>(`/residents/${id}`);
  return data;
}

export interface UpdateResidentInput {
  fullName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  homeAddress?: string;
  homeCity?: string;
  homeState?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  workOrInstitution?: string;
  workAddress?: string;
  withFood?: boolean;
  photoUrl?: string;
}

export async function updateResident(id: string, input: UpdateResidentInput): Promise<ResidentDetail> {
  const { data } = await api.patch<ResidentDetail>(`/residents/${id}`, input);
  return data;
}

export async function giveResidentNotice(
  id: string,
  input: { expectedLeavingOn?: string; note?: string },
) {
  const { data } = await api.post(`/residents/${id}/notice`, input);
  return data;
}

export async function cancelResidentNotice(id: string) {
  const { data } = await api.delete(`/residents/${id}/notice`);
  return data;
}

export async function relieveResident(
  id: string,
  input: { actualLeavingOn: string; damagesAmount: number; notes?: string },
) {
  const { data } = await api.post(`/residents/${id}/relieve`, input);
  return data as { residentId: string; refundable: number };
}
