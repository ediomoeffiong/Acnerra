"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = void 0;
const CheckIn_1 = require("../models/CheckIn");
const Task_1 = require("../models/Task");
const Workspace_1 = require("../models/Workspace");
const PartnerRelation_1 = require("../models/PartnerRelation");
const ProgressRequest_1 = require("../models/ProgressRequest");
const streak_1 = require("../lib/streak");
const getDateRange = (range, customStart, customEnd) => {
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
    }
    else if (range === 'monthly' || range === '30d') {
        start.setDate(now.getDate() - 30);
    }
    else {
        // default 7 days ('weekly' or '7d')
        start.setDate(now.getDate() - 7);
    }
    return { start, end: now };
};
const getAnalytics = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    const range = typeof req.query.range === 'string' ? req.query.range : '7d';
    const { start, end } = getDateRange(range, req.query.start, req.query.end);
    const userId = req.user.userId;
    try {
        // 1. Personal tasks (strictly owned by authenticated user)
        const personalTasks = await Task_1.Task.find({
            $or: [
                { ownerId: userId },
                { ownerId: null, creatorId: userId },
            ],
            createdAt: { $lte: end },
        });
        const personalTaskIds = personalTasks.map((task) => task._id);
        // 2. Personal check-ins
        const checkIns = await CheckIn_1.CheckIn.find({
            taskId: { $in: personalTaskIds },
            createdAt: { $gte: start, $lte: end },
            $or: [
                { kind: CheckIn_1.CheckInKind.OWNER_PROGRESS },
                { kind: null, userId },
            ],
        }).sort({ createdAt: 1 });
        const completedTasks = personalTasks.filter((task) => task.status === Task_1.TaskStatus.COMPLETED);
        const now = new Date();
        const overdueTasks = personalTasks.filter((task) => task.status !== Task_1.TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) < now);
        // Milestones metrics
        let totalMilestones = 0;
        let completedMilestones = 0;
        personalTasks.forEach((t) => {
            (t.milestones || []).forEach((m) => {
                totalMilestones++;
                if (m.status === Task_1.MilestoneStatus.COMPLETED)
                    completedMilestones++;
            });
        });
        // Recurring task adherence
        const recurringTasks = personalTasks.filter((t) => t.isRecurringInstance || (t.recurrence && t.recurrence.frequency !== 'NONE'));
        const recurringCompleted = recurringTasks.filter((t) => t.status === Task_1.TaskStatus.COMPLETED);
        const recurringAdherence = recurringTasks.length ? Math.round((recurringCompleted.length / recurringTasks.length) * 100) : 100;
        // Check-in status counts
        const completedCheckIns = checkIns.filter((c) => c.status === CheckIn_1.CheckInStatus.COMPLETED).length;
        const inProgressCheckIns = checkIns.filter((c) => c.status === CheckIn_1.CheckInStatus.IN_PROGRESS).length;
        const missedCheckIns = checkIns.filter((c) => c.status === CheckIn_1.CheckInStatus.MISSED).length;
        // Daily activity trends
        const activityByDay = {};
        // Initialize all dates in range with 0
        const cursor = new Date(start);
        while (cursor <= end) {
            const key = cursor.toISOString().slice(0, 10);
            activityByDay[key] = { checkIns: 0, completions: 0 };
            cursor.setDate(cursor.getDate() + 1);
        }
        checkIns.forEach((checkIn) => {
            const key = new Date(checkIn.createdAt).toISOString().slice(0, 10);
            if (activityByDay[key]) {
                activityByDay[key].checkIns += 1;
            }
        });
        completedTasks.forEach((task) => {
            const key = new Date(task.updatedAt).toISOString().slice(0, 10);
            if (activityByDay[key]) {
                activityByDay[key].completions += 1;
            }
        });
        // Workspaces metrics
        const rawWorkspacesList = await Workspace_1.Workspace.find({
            $or: [{ userId }, { collaboratorIds: userId }],
        }).sort({ createdAt: 1 });
        const workspaceStats = rawWorkspacesList.map((ws) => {
            const wsTasks = personalTasks.filter((t) => t.workspaceId?.toString() === ws._id.toString());
            const total = wsTasks.length;
            const completed = wsTasks.filter((t) => t.status === Task_1.TaskStatus.COMPLETED).length;
            const wsOverdue = wsTasks.filter((t) => t.status !== Task_1.TaskStatus.COMPLETED && t.dueDate && new Date(t.dueDate) < now).length;
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
        const streakData = await (0, streak_1.calculateUserStreak)(userId);
        // 3. Partner Insights (tasks monitored, feedback given, pending verifications, progress requests)
        const monitoredTasks = await Task_1.Task.find({
            $or: [{ sharedWithIds: userId }, { collaboratorIds: userId }, { partnerId: userId }],
            ownerId: { $ne: userId },
            visibility: { $ne: Task_1.TaskVisibility.PRIVATE },
        });
        const [feedbackGivenCount, pendingVerificationsForMe, pendingRequestsForMe] = await Promise.all([
            CheckIn_1.CheckIn.countDocuments({ userId, kind: CheckIn_1.CheckInKind.PARTNER_FEEDBACK, createdAt: { $gte: start, $lte: end } }),
            Task_1.Task.countDocuments({ verifierId: userId, verificationStatus: Task_1.VerificationStatus.PENDING, status: Task_1.TaskStatus.COMPLETED }),
            ProgressRequest_1.ProgressRequest.countDocuments({ requesterId: userId, status: ProgressRequest_1.ProgressRequestStatus.PENDING }),
        ]);
        // Partner relationships
        const partnerRelations = await PartnerRelation_1.PartnerRelation.find({
            status: PartnerRelation_1.PartnerStatus.ACCEPTED,
            $or: [{ senderId: userId }, { receiverId: userId }],
        }).populate('senderId receiverId', 'id username name image');
        const partnerStats = partnerRelations.map((r) => {
            const partnerUser = r.senderId._id.toString() === userId ? r.receiverId : r.senderId;
            const sharedTasks = personalTasks.filter((t) => t.sharedWithIds?.some((id) => id.toString() === partnerUser._id.toString()));
            const total = sharedTasks.length;
            const completed = sharedTasks.filter((t) => t.status === Task_1.TaskStatus.COMPLETED).length;
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
    }
    catch (error) {
        console.error('Get analytics error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving analytics.' });
    }
};
exports.getAnalytics = getAnalytics;
