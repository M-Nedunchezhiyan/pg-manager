import { api } from './api';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export const listNotifications = async (): Promise<{ items: NotificationItem[]; unread: number }> =>
  (await api.get<{ items: NotificationItem[]; unread: number }>('/notifications')).data;

export const markNotificationRead = async (id: string): Promise<void> => {
  await api.post(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.post('/notifications/read-all');
};
