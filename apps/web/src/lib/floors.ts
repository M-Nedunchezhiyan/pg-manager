import { api } from './api';

export type AllowedGender = 'MALE' | 'FEMALE' | 'ANY';

export interface Floor {
  id: string;
  pgId: string;
  number: number;
  name: string | null;
  allowedGender: AllowedGender;
  _count?: { rooms: number };
}

export interface SharingType {
  id: string;
  pgId: string;
  name: string;
  capacity: number;
  monthlyRent: number; // paise
  _count?: { rooms: number };
}

export async function listFloors(pgId: string): Promise<Floor[]> {
  const { data } = await api.get<Floor[]>('/floors', { params: { pgId } });
  return data;
}

export async function createFloor(input: {
  pgId: string;
  number: number;
  name?: string;
  allowedGender?: AllowedGender;
}): Promise<Floor> {
  const { data } = await api.post<Floor>('/floors', input);
  return data;
}

export async function updateFloor(
  floorId: string,
  input: { number?: number; name?: string; allowedGender?: AllowedGender },
): Promise<Floor> {
  const { data } = await api.patch<Floor>(`/floors/${floorId}`, input);
  return data;
}

export async function deleteFloor(floorId: string): Promise<void> {
  await api.delete(`/floors/${floorId}`);
}

export async function listSharingTypes(pgId: string): Promise<SharingType[]> {
  const { data } = await api.get<SharingType[]>('/sharing-types', { params: { pgId } });
  return data;
}

export async function createSharingType(input: {
  pgId: string;
  name: string;
  capacity: number;
  monthlyRent: number;
}): Promise<SharingType> {
  const { data } = await api.post<SharingType>('/sharing-types', input);
  return data;
}

export async function updateSharingType(
  id: string,
  input: { name?: string; capacity?: number; monthlyRent?: number },
): Promise<SharingType> {
  const { data } = await api.patch<SharingType>(`/sharing-types/${id}`, input);
  return data;
}

export async function deleteSharingType(id: string): Promise<void> {
  await api.delete(`/sharing-types/${id}`);
}
