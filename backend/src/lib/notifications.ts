import { Notification, NotificationCategory, NotificationPriority } from '../models/Notification';
import { User } from '../models/User';
import { sendEmailNotification } from './email';

interface NotificationInput {
  userId: any;
  type: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  actionUrl?: string;
  taskId?: any;
  inviteId?: any;
  partnerRelationId?: any;
  progressRequestId?: any;
}

const mapTypeToCategory = (type: string): NotificationCategory => {
  if (type.startsWith('INVITE')) return NotificationCategory.INVITES;
  if (type.includes('FEEDBACK') || type === 'CHECK_IN_SUBMITTED') return NotificationCategory.FEEDBACK;
  if (type.includes('VERIFICATION')) return NotificationCategory.VERIFICATION;
  if (type.includes('REMINDER') || type.includes('OVERDUE') || type === 'PROGRESS_REQUEST') return NotificationCategory.REMINDERS;
  return NotificationCategory.TASKS;
};

export const createNotification = async (input: NotificationInput) => {
  const category = input.category || mapTypeToCategory(input.type);
  const priority = input.priority || NotificationPriority.NORMAL;

  try {
    // Check for duplicate unread notification for same user and context within 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existing = await Notification.findOne({
      userId: input.userId,
      type: input.type,
      taskId: input.taskId || null,
      inviteId: input.inviteId || null,
      read: false,
      createdAt: { $gte: tenMinutesAgo },
    });

    if (existing) {
      // Update existing timestamp instead of creating duplicate spam
      existing.updatedAt = new Date();
      existing.message = input.message;
      await existing.save();
      return existing;
    }

    const notification = await Notification.create({
      userId: input.userId,
      type: input.type,
      category,
      priority,
      actionUrl: input.actionUrl || (input.taskId ? `/tasks/${input.taskId}` : null),
      title: input.title,
      message: input.message,
      taskId: input.taskId || null,
      inviteId: input.inviteId || null,
      partnerRelationId: input.partnerRelationId || null,
      progressRequestId: input.progressRequestId || null,
    });

    // Check user email notification preferences
    const user = await User.findById(input.userId).select('email preferences');
    if (user && user.email && user.preferences?.emailNotifications) {
      const catKey = category.toLowerCase() as 'tasks' | 'invites' | 'feedback' | 'verification' | 'reminders';
      const categoryAllowed = user.preferences.categories?.[catKey] !== false;

      // Check quiet hours
      let inQuietHours = false;
      if (user.preferences.quietHours?.enabled) {
        const now = new Date();
        const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const { start, end } = user.preferences.quietHours;
        if (start && end) {
          if (start <= end) {
            inQuietHours = currentHourMin >= start && currentHourMin <= end;
          } else {
            // Over midnight
            inQuietHours = currentHourMin >= start || currentHourMin <= end;
          }
        }
      }

      if (categoryAllowed && !inQuietHours) {
        // Send email in background without blocking API response
        sendEmailNotification({
          to: user.email,
          subject: `[Acnerra] ${input.title}`,
          text: `${input.message}\n\nView details in Acnerra: ${process.env.FRONTEND_URL || 'https://acnerra.com'}${notification.actionUrl || ''}`,
          dedupKey: `${user._id.toString()}_${input.type}_${input.taskId || input.inviteId || ''}`,
        }).catch((err) => console.error('Background email dispatch failed:', err));
      }
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};
