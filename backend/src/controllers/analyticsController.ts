import { Response } from 'express';
import { CheckIn, CheckInKind, CheckInStatus } from '../models/CheckIn';
import { Task, TaskStatus, MilestoneStatus, TaskVisibility, VerificationStatus } from '../models/Task';
import { Workspace } from '../models/Workspace';
import { PartnerRelation, PartnerMode, PartnerStatus } from '../models/PartnerRelation';
import { ProgressRequest, ProgressRequestStatus } from '../models/ProgressRequest';
import { calculateUserStreak } from '../lib/streak';

const getDateRange = (range: string | undefined, customStart?: string, customEnd?: string) => {
  const now = new Date();
  let start = new Date(now);

  if (range === 'custom' && customStart) {
    const s = new Date(customStart);
    const e = customEnd ? new Date(customEnd) : now;
    if (!Number.isNaN(s.getTime())) {
      return { start: s, end: Number.isNaN(e.getTime()) ? now : e };
    }
  }

  if (range === '90d') {
    start.setDate(now.getDate() - 90);
  } else if (range === 'monthly' || range === '30d') {
    start.setDate(now.getDate() - 30);
  } else {
    // default 7 days ('weekly' or '7d')
    start.setDate(now.getDate() - 7);
  }

  return { start, end: now };
};

export const getAnalytics = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const range = typeof req.query.range === 'string' ? req.query.range : '7d';
  const { start, end } = getDateRange(range, req.query.start as string, req.query.end as string);
  const userId = req.user.userId;

  try {
    // 1. Personal tasks (strictly owned by authenticated user)
    const personalTasks = await Task.find({
      $or: [
        { ownerId: userId },
        { ownerId: null, creatorId: userId },
      ],
      createdAt: { $lte: end },
    });

    const personalTaskIds = personalTasks.map((task) => task._id);

    // 2. Personal check-ins
    const checkIns = await CheckIn.find({
      taskId: { $in: personalTaskIds },
      createdAt: { $gte: start, $lte: end },
      $or: [
        { kind: CheckInKind.OWNER_PROGRESS },
        { kind: null, userId },
      ],
    }).sort({ createdAt: 1 });

    const completedTasks = personalTasks.filter((task) => task.status === TaskStatus.COMPLETED);
    const now = new Date();
    const overdueTasks = personalTasks.filter(
      (task) => task.status !== TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) < now
    );

    // Milestones metrics
    let totalMilestones = 0;
    let completedMilestones = 0;
    personalTasks.forEach((t: any) => {
      (t.milestones || []).forEach((m: any) => {
        totalMilestones++;
        if (m.status === MilestoneStatus.COMPLETED) completedMilestones++;
      });
    });

    // Recurring task adherence
    const recurringTasks = personalTasks.filter((t: any) => t.isRecurringInstance || (t.recurrence && t.recurrence.frequency !== 'NONE'));
    const recurringCompleted = recurringTasks.filter((t) => t.status === TaskStatus.COMPLETED);
    const recurringAdherence = recurringTasks.length ? Math.round((recurringCompleted.length / recurringTasks.length) * 100) : 100;

    // Check-in status counts
    const completedCheckIns = checkIns.filter((c) => c.status === CheckInStatus.COMPLETED).length;
    const inProgressCheckIns = checkIns.filter((c) => c.status === CheckInStatus.IN_PROGRESS).length;
    const missedCheckIns = checkIns.filter((c) => c.status === CheckInStatus.MISSED).length;

    // Daily activity trends
    const activityByDay: Record<string, { checkIns: number; completions: number }> = {};

    // Initialize all dates in range with 0
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      activityByDay[key] = { checkIns: 0, completions: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    checkIns.forEach((checkIn: any) => {
      const key = new Date(checkIn.createdAt).toISOString().slice(0, 10);
      if (activityByDay[key]) {
        activityByDay[key].checkIns += 1;
      }
    });

    completedTasks.forEach((task: any) => {
      const key = new Date(task.updatedAt).toISOString().slice(0, 10);
      if (activityByDay[key]) {
        activityByDay[key].completions += 1;
      }
    });

    // Workspaces metrics
    const rawWorkspacesList = await Workspace.find({
      $or: [{ userId }, { collaboratorIds: userId }],
    }).sort({ createdAt: 1 });

    const workspaceStats = rawWorkspacesList.map((ws: any) => {
      const wsTasks = personalTasks.filter((t) => t.workspaceId?.toString() === ws._id.toString());
      const total = wsTasks.length;
      const completed = wsTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const wsOverdue = wsTasks.filter((t) => t.status !== TaskStatus.COMPLETED && t.dueDate && new Date(t.dueDate) < now).length;

      return {
        workspaceId: ws._id.toString(),
        name: ws.name,
        isDefault: ws.isDefault,
        totalTasks: total,
        completedTasks: completed,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        overdueTasks: wsOverdue,
      };
    });

    // Streak stats
    const streakData = await calculateUserStreak(userId);

    // 3. Partner Insights (tasks monitored, feedback given, pending verifications, progress requests)
    const monitoredTasks = await Task.find({
      $or: [{ sharedWithIds: userId }, { collaboratorIds: userId }, { partnerId: userId }],
      ownerId: { $ne: userId },
      visibility: { $ne: TaskVisibility.PRIVATE },
    });

    const [feedbackGivenCount, pendingVerificationsForMe, pendingRequestsForMe] = await Promise.all([
      CheckIn.countDocuments({ userId, kind: CheckInKind.PARTNER_FEEDBACK, createdAt: { $gte: start, $lte: end } }),
      Task.countDocuments({ verifierId: userId, verificationStatus: VerificationStatus.PENDING, status: TaskStatus.COMPLETED }),
      ProgressRequest.countDocuments({ requesterId: userId, status: ProgressRequestStatus.PENDING }),
    ]);

    // Partner relationships
    const partnerRelations = await PartnerRelation.find({
      status: PartnerStatus.ACCEPTED,
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).populate('senderId receiverId', 'id username name image');

    const partnerStats = partnerRelations.map((r: any) => {
      const partnerUser = r.senderId._id.toString() === userId ? r.receiverId : r.senderId;
      const sharedTasks = personalTasks.filter((t: any) =>
        t.sharedWithIds?.some((id: any) => id.toString() === partnerUser._id.toString())
      );
      const total = sharedTasks.length;
      const completed = sharedTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;

      return {
        partnerId: partnerUser._id.toString(),
        username: partnerUser.username,
        name: partnerUser.name || partnerUser.username,
        image: partnerUser.image,
        mode: r.mode,
        totalTasks: total,
        completedTasks: completed,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
      };
    });

    return res.status(200).json({
      range,
      start,
      end,
      metrics: {
        totalTasks: personalTasks.length,
        completedTasks: completedTasks.length,
        completionRate: personalTasks.length ? Math.round((completedTasks.length / personalTasks.length) * 100) : 0,
        overdueTasks: overdueTasks.length,
        totalCheckIns: checkIns.length,
        checkInConsistency: checkIns.length ? Math.round((completedCheckIns / checkIns.length) * 100) : 0,
        completedCheckIns,
        inProgressCheckIns,
        missedCheckIns,
        milestones: {
          total: totalMilestones,
          completed: completedMilestones,
          rate: totalMilestones ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
        },
        recurringAdherence,
        streak: {
          current: streakData.streakDays,
        },
      },
      activityByDay,
      workspaces: workspaceStats,
      partners: partnerStats,
      partnerInsights: {
        monitoredTasksCount: monitoredTasks.length,
        feedbackGivenCount,
        pendingVerificationsCount: pendingVerificationsForMe,
        pendingProgressRequestsCount: pendingRequestsForMe,
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving analytics.' });
  }
};
