import { User } from '../models/User';
import { Task, TaskStatus, MilestoneStatus } from '../models/Task';
import { CheckIn, CheckInKind } from '../models/CheckIn';
import { PartnerRelation, PartnerStatus } from '../models/PartnerRelation';
import { XPTransaction, XPReason } from '../models/XPTransaction';
import { calculateUserStreak } from './streak';
import { createNotification } from './notifications';
import { NotificationCategory, NotificationPriority } from '../models/Notification';

export const XP_VALUES = {
  [XPReason.TASK_COMPLETED]: 50,
  [XPReason.MILESTONE_COMPLETED]: 25,
  [XPReason.CHECK_IN_SUBMITTED]: 10,
  [XPReason.RECURRING_TASK_COMPLETED]: 15,
};

export const ACHIEVEMENTS_CATALOG = [
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

export const awardXP = async (
  userId: string,
  reason: XPReason,
  referenceId: string,
  customAmount?: number
): Promise<{ awarded: number; newTotalXP: number; newLevel: number; levelUp: boolean }> => {
  const amount = customAmount !== undefined ? customAmount : XP_VALUES[reason] || 10;

  try {
    // Attempt idempotent insert
    await XPTransaction.create({
      userId,
      amount,
      reason,
      referenceId,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Duplicate transaction: already awarded, return existing user xp
      const u = await User.findById(userId).select('xp level');
      return { awarded: 0, newTotalXP: u?.xp || 0, newLevel: u?.level || 1, levelUp: false };
    }
    throw err;
  }

  // Update user XP & Level
  const user = await User.findById(userId);
  if (!user) return { awarded: 0, newTotalXP: 0, newLevel: 1, levelUp: false };

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
    await createNotification({
      userId,
      type: 'LEVEL_UP',
      category: NotificationCategory.TASKS,
      priority: NotificationPriority.HIGH,
      title: 'Level Up!',
      message: `Congratulations! You just reached Level ${newLevel}!`,
    });
  }

  // Re-evaluate achievements
  await evaluateAchievements(userId);

  return { awarded: amount, newTotalXP: newXP, newLevel, levelUp };
};

export const evaluateAchievements = async (userId: string) => {
  try {
    const user = await User.findById(userId);
    if (!user) return [];

    const unlockedIds = new Set((user.achievements || []).map((a: any) => a.id));
    const newlyUnlocked: any[] = [];

    // Fetch counts needed for achievement checks
    const [totalTasks, completedTasks, ownerCheckIns, partnerCount, streak] = await Promise.all([
      Task.countDocuments({ ownerId: userId }),
      Task.countDocuments({ ownerId: userId, status: TaskStatus.COMPLETED }),
      CheckIn.countDocuments({ userId, kind: CheckInKind.OWNER_PROGRESS }),
      PartnerRelation.countDocuments({
        status: PartnerStatus.ACCEPTED,
        $or: [{ senderId: userId }, { receiverId: userId }],
      }),
      calculateUserStreak(userId),
    ]);

    // Count completed milestones across all user tasks
    const tasksWithMilestones = await Task.find({ ownerId: userId, 'milestones.0': { $exists: true } }).select('milestones');
    let completedMilestones = 0;
    tasksWithMilestones.forEach((t: any) => {
      (t.milestones || []).forEach((m: any) => {
        if (m.status === MilestoneStatus.COMPLETED) completedMilestones++;
      });
    });

    // Update streak on user
    user.currentStreak = streak.streakDays;
    user.longestStreak = Math.max(user.longestStreak || 0, streak.streakDays);

    for (const ach of ACHIEVEMENTS_CATALOG) {
      if (unlockedIds.has(ach.id)) continue;

      let qualifies = false;
      if (ach.id === 'FIRST_COMMITMENT' && totalTasks >= 1) qualifies = true;
      if (ach.id === 'FIVE_TASKS_COMPLETED' && completedTasks >= 5) qualifies = true;
      if (ach.id === 'SEVEN_DAY_STREAK' && (user.currentStreak >= 7 || user.longestStreak >= 7)) qualifies = true;
      if (ach.id === 'MILESTONE_MASTER' && completedMilestones >= 3) qualifies = true;
      if (ach.id === 'CONSISTENT_PERFORMER' && ownerCheckIns >= 10) qualifies = true;
      if (ach.id === 'ACCOUNTABILITY_CHAMPION' && partnerCount >= 3) qualifies = true;

      if (qualifies) {
        const item = {
          id: ach.id,
          name: ach.name,
          description: ach.description,
          icon: ach.icon,
          unlockedAt: new Date(),
        };
        user.achievements.push(item as any);
        unlockedIds.add(ach.id);
        newlyUnlocked.push(item);

        await createNotification({
          userId,
          type: 'ACHIEVEMENT_UNLOCKED',
          category: NotificationCategory.TASKS,
          priority: NotificationPriority.HIGH,
          title: 'Achievement Unlocked!',
          message: `You earned the "${ach.name}" badge: ${ach.description}`,
        });
      }
    }

    if (newlyUnlocked.length > 0 || user.isModified('currentStreak') || user.isModified('longestStreak')) {
      await user.save();
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('Evaluate achievements error:', error);
    return [];
  }
};
