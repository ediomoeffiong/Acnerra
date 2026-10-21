"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAchievements = exports.awardXP = exports.ACHIEVEMENTS_CATALOG = exports.XP_VALUES = void 0;
const User_1 = require("../models/User");
const Task_1 = require("../models/Task");
const CheckIn_1 = require("../models/CheckIn");
const PartnerRelation_1 = require("../models/PartnerRelation");
const XPTransaction_1 = require("../models/XPTransaction");
const streak_1 = require("./streak");
const notifications_1 = require("./notifications");
const Notification_1 = require("../models/Notification");
exports.XP_VALUES = {
    [XPTransaction_1.XPReason.TASK_COMPLETED]: 50,
    [XPTransaction_1.XPReason.MILESTONE_COMPLETED]: 25,
    [XPTransaction_1.XPReason.CHECK_IN_SUBMITTED]: 10,
    [XPTransaction_1.XPReason.RECURRING_TASK_COMPLETED]: 15,
};
exports.ACHIEVEMENTS_CATALOG = [
    {
        id: 'FIRST_COMMITMENT',
        name: 'First Commitment',
        description: 'Created your very first accountability goal.',
        icon: 'target',
    },
    {
        id: 'FIVE_TASKS_COMPLETED',
        name: 'Five Tasks Completed',
        description: 'Reached completion on 5 accountability tasks.',
        icon: 'check-circle-2',
    },
    {
        id: 'SEVEN_DAY_STREAK',
        name: 'Seven-Day Consistency',
        description: 'Maintained a 7-day consistency streak.',
        icon: 'flame',
    },
    {
        id: 'MILESTONE_MASTER',
        name: 'Milestone Master',
        description: 'Successfully reached 3 significant task milestones.',
        icon: 'flag',
    },
    {
        id: 'CONSISTENT_PERFORMER',
        name: 'Consistent Performer',
        description: 'Shared 10 honest progress check-ins.',
        icon: 'trending-up',
    },
    {
        id: 'ACCOUNTABILITY_CHAMPION',
        name: 'Accountability Champion',
        description: 'Partnered with 3 active accountability buddies.',
        icon: 'users',
    },
];
const awardXP = async (userId, reason, referenceId, customAmount) => {
    const amount = customAmount !== undefined ? customAmount : exports.XP_VALUES[reason] || 10;
    try {
        // Attempt idempotent insert
        await XPTransaction_1.XPTransaction.create({
            userId,
            amount,
            reason,
            referenceId,
        });
    }
    catch (err) {
        if (err?.code === 11000) {
            // Duplicate transaction: already awarded, return existing user xp
            const u = await User_1.User.findById(userId).select('xp level');
            return { awarded: 0, newTotalXP: u?.xp || 0, newLevel: u?.level || 1, levelUp: false };
        }
        throw err;
    }
    // Update user XP & Level
    const user = await User_1.User.findById(userId);
    if (!user)
        return { awarded: 0, newTotalXP: 0, newLevel: 1, levelUp: false };
    const oldLevel = user.level || 1;
    const newXP = (user.xp || 0) + amount;
    // Formula: level = 1 + floor(sqrt(xp / 100))
    const newLevel = Math.max(1, 1 + Math.floor(Math.sqrt(newXP / 100)));
    const levelUp = newLevel > oldLevel;
    user.xp = newXP;
    user.level = newLevel;
    user.lastActiveDate = new Date();
    await user.save();
    if (levelUp) {
        await (0, notifications_1.createNotification)({
            userId,
            type: 'LEVEL_UP',
            category: Notification_1.NotificationCategory.TASKS,
            priority: Notification_1.NotificationPriority.HIGH,
            title: 'Level Up!',
            message: `Congratulations! You just reached Level ${newLevel}!`,
        });
    }
    // Re-evaluate achievements
    await (0, exports.evaluateAchievements)(userId);
    return { awarded: amount, newTotalXP: newXP, newLevel, levelUp };
};
exports.awardXP = awardXP;
const evaluateAchievements = async (userId) => {
    try {
        const user = await User_1.User.findById(userId);
        if (!user)
            return [];
        const unlockedIds = new Set((user.achievements || []).map((a) => a.id));
        const newlyUnlocked = [];
        // Fetch counts needed for achievement checks
        const [totalTasks, completedTasks, ownerCheckIns, partnerCount, streak] = await Promise.all([
            Task_1.Task.countDocuments({ ownerId: userId }),
            Task_1.Task.countDocuments({ ownerId: userId, status: Task_1.TaskStatus.COMPLETED }),
            CheckIn_1.CheckIn.countDocuments({ userId, kind: CheckIn_1.CheckInKind.OWNER_PROGRESS }),
            PartnerRelation_1.PartnerRelation.countDocuments({
                status: PartnerRelation_1.PartnerStatus.ACCEPTED,
                $or: [{ senderId: userId }, { receiverId: userId }],
            }),
            (0, streak_1.calculateUserStreak)(userId),
        ]);
        // Count completed milestones across all user tasks
        const tasksWithMilestones = await Task_1.Task.find({ ownerId: userId, 'milestones.0': { $exists: true } }).select('milestones');
        let completedMilestones = 0;
        tasksWithMilestones.forEach((t) => {
            (t.milestones || []).forEach((m) => {
                if (m.status === Task_1.MilestoneStatus.COMPLETED)
                    completedMilestones++;
            });
        });
        // Update streak on user
        user.currentStreak = streak.streakDays;
        user.longestStreak = Math.max(user.longestStreak || 0, streak.streakDays);
        for (const ach of exports.ACHIEVEMENTS_CATALOG) {
            if (unlockedIds.has(ach.id))
                continue;
            let qualifies = false;
            if (ach.id === 'FIRST_COMMITMENT' && totalTasks >= 1)
                qualifies = true;
            if (ach.id === 'FIVE_TASKS_COMPLETED' && completedTasks >= 5)
                qualifies = true;
            if (ach.id === 'SEVEN_DAY_STREAK' && (user.currentStreak >= 7 || user.longestStreak >= 7))
                qualifies = true;
            if (ach.id === 'MILESTONE_MASTER' && completedMilestones >= 3)
                qualifies = true;
            if (ach.id === 'CONSISTENT_PERFORMER' && ownerCheckIns >= 10)
                qualifies = true;
            if (ach.id === 'ACCOUNTABILITY_CHAMPION' && partnerCount >= 3)
                qualifies = true;
            if (qualifies) {
                const item = {
                    id: ach.id,
                    name: ach.name,
                    description: ach.description,
                    icon: ach.icon,
                    unlockedAt: new Date(),
                };
                user.achievements.push(item);
                unlockedIds.add(ach.id);
                newlyUnlocked.push(item);
                await (0, notifications_1.createNotification)({
                    userId,
                    type: 'ACHIEVEMENT_UNLOCKED',
                    category: Notification_1.NotificationCategory.TASKS,
                    priority: Notification_1.NotificationPriority.HIGH,
                    title: 'Achievement Unlocked!',
                    message: `You earned the "${ach.name}" badge: ${ach.description}`,
                });
            }
        }
        if (newlyUnlocked.length > 0 || user.isModified('currentStreak') || user.isModified('longestStreak')) {
            await user.save();
        }
        return newlyUnlocked;
    }
    catch (error) {
        console.error('Evaluate achievements error:', error);
        return [];
    }
};
exports.evaluateAchievements = evaluateAchievements;
