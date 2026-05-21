import { api } from './api';

export type ExpenseCategory =
  | 'ELECTRICITY'
  | 'WATER'
  | 'GAS'
  | 'INTERNET'
  | 'SALARY'
  | 'GROCERY'
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'RENT'
  | 'TAX'
  | 'OTHER';

export interface Expense {
  id: string;
  pgId: string;
  category: ExpenseCategory;
  amount: number;
  spentOn: string;
  note: string | null;
  attachmentUrl: string | null;
}

export const listExpenses = async (pgId: string, from?: string, to?: string): Promise<Expense[]> =>
  (await api.get<Expense[]>('/expenses', { params: { pgId, from, to } })).data;

export const createExpense = async (input: {
  pgId: string;
  category: ExpenseCategory;
  amount: number;
  spentOn: string;
  note?: string;
  attachmentUrl?: string;
}): Promise<Expense> => (await api.post<Expense>('/expenses', input)).data;

export const deleteExpense = async (id: string): Promise<void> => {
  await api.delete(`/expenses/${id}`);
};
