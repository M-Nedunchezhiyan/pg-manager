import { api } from './api';

export interface PgManager {
  id: string;
  name: string;
  email: string;
}

export interface AssignManagerInput {
  name: string;
  email: string;
}

export interface AssignManagerResult extends PgManager {
  temporaryPassword: string | null;
}

export async function getPgManager(pgId: string): Promise<PgManager | null> {
  const { data } = await api.get<{ manager: PgManager | null }>(`/pgs/${pgId}/manager`);
  return data.manager;
}

export async function assignPgManager(pgId: string, input: AssignManagerInput): Promise<AssignManagerResult> {
  const { data } = await api.post<AssignManagerResult>(`/pgs/${pgId}/manager`, input);
  return data;
}

export async function removePgManager(pgId: string): Promise<void> {
  await api.delete(`/pgs/${pgId}/manager`);
}
