import { api } from './api';

export type PGType = 'MALE' | 'FEMALE' | 'COED';

export interface PG {
  id: string;
  name: string;
  type: PGType;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  imageUrl?: string;
  isActive: boolean;
  settings?: { advanceMonths: number; dueDaysAfterJoin: number; lateFeePerDay: number; noticeDays: number };
  _count?: { residents: number };
}

export interface CreatePGInput {
  name: string;
  type: PGType;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  imageUrl?: string;
}

export interface PGDetail extends PG {
  settings: {
    advanceMonths: number;
    dueDaysAfterJoin: number;
    lateFeePerDay: number;
    noticeDays: number;
    currency: string;
  };
  floors: Array<{ id: string; number: number; name: string | null; allowedGender: 'MALE' | 'FEMALE' | 'ANY' }>;
  sharingTypes: Array<{ id: string; name: string; capacity: number; monthlyRent: number }>;
}

export async function listPGs(): Promise<PG[]> {
  const { data } = await api.get<PG[]>('/pgs');
  return data;
}

export async function getPG(pgId: string): Promise<PGDetail> {
  const { data } = await api.get<PGDetail>(`/pgs/${pgId}`);
  return data;
}

export async function createPG(input: CreatePGInput): Promise<PG> {
  const { data } = await api.post<PG>('/pgs', input);
  return data;
}

export async function updatePGSettings(
  pgId: string,
  input: { advanceMonths?: number; dueDaysAfterJoin?: number; lateFeePerDay?: number; noticeDays?: number },
): Promise<PGDetail['settings']> {
  const { data } = await api.put<PGDetail['settings']>(`/pgs/${pgId}/settings`, input);
  return data;
}
