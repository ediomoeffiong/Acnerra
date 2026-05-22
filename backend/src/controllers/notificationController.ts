import { Response } from 'express';
import { Notification } from '../models/Notification';

export const listNotifications = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      notifications: notifications.map((notification) => notification.toJSON()),
      unreadCount: notifications.filter((notification) => !notification.read).length,
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving notifications.' });
  }
};

export const markNotificationRead = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { read: true },
      { new: true }
    );

    if (!notification) return res.status(404).json({ message: 'Notification not found.' });

    return res.status(200).json({ notification: notification.toJSON() });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ message: 'An error occurred while updating the notification.' });
  }
};

export const markAllNotificationsRead = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    await Notification.updateMany({ userId: req.user.userId, read: false }, { read: true });
    return res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ message: 'An error occurred while updating notifications.' });
  }
};
