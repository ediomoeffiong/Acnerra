import api from './api';

export interface NotificationItem {
  id: string;
  type: string;
  category?: 'TASKS' | 'INVITES' | 'FEEDBACK' | 'VERIFICATION' | 'REMINDERS';
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string | null;
  taskId?: string | null;
  inviteId?: string | null;
  progressRequestId?: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  categories: {
    tasks: boolean;
    invites: boolean;
    feedback: boolean;
    verification: boolean;
    reminders: boolean;
  };
  reminderTiming: '1_HOUR' | 'SAME_DAY' | '1_DAY';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  digestFrequency: 'NONE' | 'DAILY' | 'WEEKLY';
}

export const notificationService = {
  listNotifications: async (category?: string, unread?: boolean): Promise<{ notifications: NotificationItem[]; unreadCount: number }> => {
    const params: any = {};
    if (category) params.category = category;
    if (unread) params.unread = true;
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  markRead: async (id: string): Promise<NotificationItem> => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data.notification;
  },

  markAllRead: async (category?: string): Promise<void> => {
    const params: any = {};
    if (category) params.category = category;
    await api.patch('/notifications/read-all', null, { params });
  },

  deleteNotification: async (id: string): Promise<void> => {
    await api.delete(`/notifications/${id}`);
  },

  getPreferences: async (): Promise<NotificationPreferences> => {
    const response = await api.get('/notifications/preferences');
    return response.data.preferences;
  },

  updatePreferences: async (preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> => {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data.preferences;
  },
};
