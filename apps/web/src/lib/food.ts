import { api } from './api';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';

export interface FoodItem {
  id: string;
  name: string;
}

export interface FoodGroup {
  id: string;
  pgId: string;
  name: string;
  mealType: MealType;
  isDefault: boolean;
  items: Array<{ itemId: string; sortOrder: number; item: FoodItem }>;
}

export interface DailyMenu {
  id: string;
  date: string;
  mealType: MealType;
  groupId: string | null;
  group: FoodGroup | null;
  items: Array<{ menuId: string; itemId: string; item: FoodItem }>;
}

export const listFoodItems = async (): Promise<FoodItem[]> =>
  (await api.get<FoodItem[]>('/food/items')).data;

export const createFoodItem = async (name: string): Promise<FoodItem> =>
  (await api.post<FoodItem>('/food/items', { name })).data;

export const deleteFoodItem = async (id: string): Promise<void> => {
  await api.delete(`/food/items/${id}`);
};

export const listFoodGroups = async (pgId: string): Promise<FoodGroup[]> =>
  (await api.get<FoodGroup[]>('/food/groups', { params: { pgId } })).data;

export const createFoodGroup = async (input: {
  pgId: string;
  name: string;
  mealType: MealType;
  itemIds: string[];
  isDefault?: boolean;
}): Promise<FoodGroup> => (await api.post<FoodGroup>('/food/groups', input)).data;

export const setGroupDefault = async (id: string): Promise<FoodGroup> =>
  (await api.post<FoodGroup>(`/food/groups/${id}/default`)).data;

export const deleteFoodGroup = async (id: string): Promise<void> => {
  await api.delete(`/food/groups/${id}`);
};

export const listMenus = async (pgId: string, from?: string, to?: string): Promise<DailyMenu[]> =>
  (await api.get<DailyMenu[]>('/food/menus', { params: { pgId, from, to } })).data;

export const setMenu = async (input: {
  pgId: string;
  date: string;
  mealType: MealType;
  groupId?: string | null;
  itemIds?: string[];
}): Promise<DailyMenu> => (await api.put<DailyMenu>('/food/menus', input)).data;

export const applyDefaults = async (pgId: string, date: string): Promise<{ applied: number }> =>
  (await api.post<{ applied: number }>(`/food/menus/apply-defaults?pgId=${pgId}&date=${date}`)).data;
