import { Response } from 'express';
import { z } from 'zod';
import { Notification, NotificationCategory } from '../models/Notification';
import { User, NotificationReminderTiming, DigestFrequency } from '../models/User';

export const listNotifications = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const filter: any = { userId: req.user.userId };
    if (req.query.category && Object.values(NotificationCategory).includes(req.query.category as any)) {
      filter.category = req.query.category;
    }
    if (req.query.unread === 'true') {
      filter.read = false;
    }

    const [notifications, totalUnread] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(100),
      Notification.countDocuments({ userId: req.user.userId, read: false }),
    ]);

    return res.status(200).json({
      notifications: notifications.map((notification) => notification.toJSON()),
      unreadCount: totalUnread,
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
      { read: true, readAt: new Date() },
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
    const filter: any = { userId: req.user.userId, read: false };
    if (req.query.category && Object.values(NotificationCategory).includes(req.query.category as any)) {
      filter.category = req.query.category;
    }
    await Notification.updateMany(filter, { read: true, readAt: new Date() });
    return res.status(200).json({ message: 'Notifications marked as read.' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ message: 'An error occurred while updating notifications.' });
  }
};

export const deleteNotification = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ message: 'Notification not found.' });
    return res.status(200).json({ message: 'Notification dismissed.' });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ message: 'An error occurred while dismissing the notification.' });
  }
};

export const getNotificationPreferences = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const user = await User.findById(req.user.userId).select('preferences');
    return res.status(200).json({ preferences: user?.preferences || {} });
  } catch (error) {
    console.error('Get preferences error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving preferences.' });
  }
};

const PreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  categories: z.object({
    tasks: z.boolean().optional(),
    invites: z.boolean().optional(),
    feedback: z.boolean().optional(),
    verification: z.boolean().optional(),
    reminders: z.boolean().optional(),
  }).optional(),
  reminderTiming: z.nativeEnum(NotificationReminderTiming).optional(),
  quietHours: z.object({
    enabled: z.boolean().optional(),
    start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }).optional(),
  digestFrequency: z.nativeEnum(DigestFrequency).optional(),
});

export const updateNotificationPreferences = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const parsed = PreferencesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.preferences = {
      ...user.preferences,
      ...parsed.data,
      categories: {
        ...(user.preferences?.categories || {}),
        ...(parsed.data.categories || {}),
      },
      quietHours: {
        ...(user.preferences?.quietHours || {}),
        ...(parsed.data.quietHours || {}),
      },
    } as any;

    await user.save();
    return res.status(200).json({ message: 'Notification preferences updated.', preferences: user.preferences });
  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({ message: 'An error occurred while updating preferences.' });
  }
};
