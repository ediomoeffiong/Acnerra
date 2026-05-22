import api from './api';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  taskId?: string | null;
  inviteId?: string | null;
  createdAt: string;
}

export const notificationService = {
  listNotifications: async (): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
    const response = await api.get('/notifications');
    return response.data;
  },

  markRead: async (id: string): Promise<NotificationItem> => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data.notification;
  },

  markAllRead: async (): Promise<void> => {
    await api.patch('/notifications/read-all');
  },
};
