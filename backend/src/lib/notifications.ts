import { Notification } from '../models/Notification';

interface NotificationInput {
  userId: any;
  type: string;
  title: string;
  message: string;
  taskId?: any;
  inviteId?: any;
}

export const createNotification = async (input: NotificationInput) => {
  return Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    taskId: input.taskId || null,
    inviteId: input.inviteId || null,
  });
};
