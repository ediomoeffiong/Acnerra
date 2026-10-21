"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationPreferences = exports.getNotificationPreferences = exports.deleteNotification = exports.markAllNotificationsRead = exports.markNotificationRead = exports.listNotifications = void 0;
const zod_1 = require("zod");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const listNotifications = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const filter = { userId: req.user.userId };
        if (req.query.category && Object.values(Notification_1.NotificationCategory).includes(req.query.category)) {
            filter.category = req.query.category;
        }
        if (req.query.unread === 'true') {
            filter.read = false;
        }
        const [notifications, totalUnread] = await Promise.all([
            Notification_1.Notification.find(filter)
                .sort({ createdAt: -1 })
                .limit(100),
            Notification_1.Notification.countDocuments({ userId: req.user.userId, read: false }),
        ]);
        return res.status(200).json({
            notifications: notifications.map((notification) => notification.toJSON()),
            unreadCount: totalUnread,
        });
    }
    catch (error) {
        console.error('List notifications error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving notifications.' });
    }
};
exports.listNotifications = listNotifications;
const markNotificationRead = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const notification = await Notification_1.Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.userId }, { read: true, readAt: new Date() }, { new: true });
        if (!notification)
            return res.status(404).json({ message: 'Notification not found.' });
        return res.status(200).json({ notification: notification.toJSON() });
    }
    catch (error) {
        console.error('Mark notification read error:', error);
        return res.status(500).json({ message: 'An error occurred while updating the notification.' });
    }
};
exports.markNotificationRead = markNotificationRead;
const markAllNotificationsRead = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const filter = { userId: req.user.userId, read: false };
        if (req.query.category && Object.values(Notification_1.NotificationCategory).includes(req.query.category)) {
            filter.category = req.query.category;
        }
        await Notification_1.Notification.updateMany(filter, { read: true, readAt: new Date() });
        return res.status(200).json({ message: 'Notifications marked as read.' });
    }
    catch (error) {
        console.error('Mark all notifications read error:', error);
        return res.status(500).json({ message: 'An error occurred while updating notifications.' });
    }
};
exports.markAllNotificationsRead = markAllNotificationsRead;
const deleteNotification = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const deleted = await Notification_1.Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        if (!deleted)
            return res.status(404).json({ message: 'Notification not found.' });
        return res.status(200).json({ message: 'Notification dismissed.' });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        return res.status(500).json({ message: 'An error occurred while dismissing the notification.' });
    }
};
exports.deleteNotification = deleteNotification;
const getNotificationPreferences = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const user = await User_1.User.findById(req.user.userId).select('preferences');
        return res.status(200).json({ preferences: user?.preferences || {} });
    }
    catch (error) {
        console.error('Get preferences error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving preferences.' });
    }
};
exports.getNotificationPreferences = getNotificationPreferences;
const PreferencesSchema = zod_1.z.object({
    emailNotifications: zod_1.z.boolean().optional(),
    categories: zod_1.z.object({
        tasks: zod_1.z.boolean().optional(),
        invites: zod_1.z.boolean().optional(),
        feedback: zod_1.z.boolean().optional(),
        verification: zod_1.z.boolean().optional(),
        reminders: zod_1.z.boolean().optional(),
    }).optional(),
    reminderTiming: zod_1.z.nativeEnum(User_1.NotificationReminderTiming).optional(),
    quietHours: zod_1.z.object({
        enabled: zod_1.z.boolean().optional(),
        start: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
        end: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }).optional(),
    digestFrequency: zod_1.z.nativeEnum(User_1.DigestFrequency).optional(),
});
const updateNotificationPreferences = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    const parsed = PreferencesSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    try {
        const user = await User_1.User.findById(req.user.userId);
        if (!user)
            return res.status(404).json({ message: 'User not found.' });
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
        };
        await user.save();
        return res.status(200).json({ message: 'Notification preferences updated.', preferences: user.preferences });
    }
    catch (error) {
        console.error('Update preferences error:', error);
        return res.status(500).json({ message: 'An error occurred while updating preferences.' });
    }
};
exports.updateNotificationPreferences = updateNotificationPreferences;
