import { api } from './api';

export type BedStatus = 'VACANT' | 'OCCUPIED' | 'BLOCKED' | 'NOTICE_PERIOD';

export interface Bed {
  id: string;
  roomId: string;
  label: string;
  status: BedStatus;
  allocations?: Array<{ id: string; resident: { id: string; fullName: string } }>;
}

export interface Room {
  id: string;
  floorId: string;
  sharingTypeId: string;
  number: string;
  rentOverride: number | null;
  sharingType: { name: string; capacity: number; monthlyRent: number };
  beds: Bed[];
}

export async function listRoomsByPg(pgId: string): Promise<Array<Room & { floor: { id: string; number: number } }>> {
  const { data } = await api.get('/rooms', { params: { pgId } });
  return data;
}

export async function createRoom(input: {
  floorId: string;
  sharingTypeId: string;
  number: string;
  rentOverride?: number;
}): Promise<Room> {
  const { data } = await api.post<Room>('/rooms', input);
  return data;
}

export async function updateRoom(
  id: string,
  input: { number?: string; sharingTypeId?: string; rentOverride?: number | null },
): Promise<Room> {
  const { data } = await api.patch<Room>(`/rooms/${id}`, input);
  return data;
}

export async function deleteRoom(id: string): Promise<void> {
  await api.delete(`/rooms/${id}`);
}

export interface BedMapFloor {
  id: string;
  number: number;
  name: string | null;
  allowedGender: 'MALE' | 'FEMALE' | 'ANY';
  rooms: Array<{
    id: string;
    number: string;
    sharingType: { name: string; capacity: number; monthlyRent: number };
    rentOverride: number | null;
    beds: Array<{
      id: string;
      label: string;
      status: BedStatus;
      allocations: Array<{
        id: string;
        resident: { id: string; fullName: string; joinedOn: string };
      }>;
    }>;
  }>;
}

export async function getBedMap(pgId: string): Promise<BedMapFloor[]> {
  const { data } = await api.get<BedMapFloor[]>('/beds/map', { params: { pgId } });
  return data;
}

export async function updateBed(
  id: string,
  input: { label?: string; status?: BedStatus },
): Promise<Bed> {
  const { data } = await api.patch<Bed>(`/beds/${id}`, input);
  return data;
}
