"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = void 0;
const CheckIn_1 = require("../models/CheckIn");
const Task_1 = require("../models/Task");
const Workspace_1 = require("../models/Workspace");
const PartnerRelation_1 = require("../models/PartnerRelation");
const getDateRange = (range) => {
    const now = new Date();
    const start = new Date(now);
    if (range === 'monthly') {
        start.setDate(now.getDate() - 30);
    }
    else {
        start.setDate(now.getDate() - 7);
    }
    return { start, end: now };
};
const getAnalytics = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    const range = typeof req.query.range === 'string' ? req.query.range : 'weekly';
    const { start, end } = getDateRange(range);
    const userId = req.user.userId;
    try {
        const tasks = await Task_1.Task.find({
            $or: [
                { creatorId: userId },
                {
                    $and: [
                        { isPrivate: { $ne: true } },
                        { $or: [{ partnerId: userId }, { collaboratorIds: userId }] }
                    ]
                }
            ],
            createdAt: { $lte: end },
        });
        const taskIds = tasks.map((task) => task._id);
        const checkIns = await CheckIn_1.CheckIn.find({
            taskId: { $in: taskIds },
            createdAt: { $gte: start, $lte: end },
        }).sort({ createdAt: 1 });
        const completedTasks = tasks.filter((task) => task.status === Task_1.TaskStatus.COMPLETED).length;
        const completedCheckIns = checkIns.filter((checkIn) => checkIn.status === CheckIn_1.CheckInStatus.COMPLETED).length;
        const inProgressCheckIns = checkIns.filter((checkIn) => checkIn.status === CheckIn_1.CheckInStatus.IN_PROGRESS).length;
        const missedCheckIns = checkIns.filter((checkIn) => checkIn.status === CheckIn_1.CheckInStatus.MISSED).length;
        const activityByDay = checkIns.reduce((acc, checkIn) => {
            const key = new Date(checkIn.createdAt).toISOString().slice(0, 10);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        // Find mutual partners to query workspaces
        const mutualRelations = await PartnerRelation_1.PartnerRelation.find({
            status: PartnerRelation_1.PartnerStatus.ACCEPTED,
            mode: PartnerRelation_1.PartnerMode.MUTUAL,
            $or: [{ senderId: userId }, { receiverId: userId }]
        });
        const mutualPartnerIds = mutualRelations.map(r => r.senderId.toString() === userId ? r.receiverId : r.senderId);
        // Fetch workspaces for user + mutual partners
        const workspacesList = await Workspace_1.Workspace.find({
            $or: [
                { userId },
                { userId: { $in: mutualPartnerIds } }
            ]
        }).populate('userId', 'id username name');
        // Calculate workspace metrics
        const workspaceStats = workspacesList.map(ws => {
            const wsTasks = tasks.filter(t => t.workspaceId?.toString() === ws._id.toString());
            const total = wsTasks.length;
            const completed = wsTasks.filter(t => t.status === Task_1.TaskStatus.COMPLETED).length;
            const completionRate = total ? Math.round((completed / total) * 100) : 0;
            const now = new Date();
            const overdue = wsTasks.filter(t => t.status !== Task_1.TaskStatus.COMPLETED && t.dueDate && new Date(t.dueDate) < now).length;
            return {
                workspaceId: ws._id.toString(),
                name: ws.name,
                owner: ws.userId,
                isDefault: ws.isDefault,
                totalTasks: total,
                completedTasks: completed,
                completionRate,
                overdueTasks: overdue
            };
        });
        // Fetch all accepted partner relationships
        const partnerRelations = await PartnerRelation_1.PartnerRelation.find({
            status: PartnerRelation_1.PartnerStatus.ACCEPTED,
            $or: [{ senderId: userId }, { receiverId: userId }]
        })
            .populate('senderId', 'id username name image')
            .populate('receiverId', 'id username name image');
        const mutualPartnersCount = partnerRelations.filter(r => r.mode === PartnerRelation_1.PartnerMode.MUTUAL).length;
        // Single partners are those that monitor the user (senderId is the user whose tasks are monitored)
        const singlePartnersCount = partnerRelations.filter(r => r.mode === PartnerRelation_1.PartnerMode.SINGLE && r.senderId._id.toString() === userId).length;
        const partnerStats = partnerRelations.map(r => {
            const partnerUser = r.senderId._id.toString() === userId ? r.receiverId : r.senderId;
            // Calculate shared tasks with this partner
            const sharedTasks = tasks.filter(t => {
                const creatorIdStr = t.creatorId.toString();
                const partnerIdStr = t.partnerId?.toString();
                const collaboratorIdsStr = t.collaboratorIds?.map((id) => id.toString()) || [];
                const isCreatorMe = creatorIdStr === userId;
                const isCreatorPartner = creatorIdStr === partnerUser._id.toString();
                if (isCreatorMe && (partnerIdStr === partnerUser._id.toString() || collaboratorIdsStr.includes(partnerUser._id.toString()))) {
                    return true;
                }
                if (isCreatorPartner && (partnerIdStr === userId || collaboratorIdsStr.includes(userId))) {
                    return true;
                }
                return false;
            });
            const total = sharedTasks.length;
            const completed = sharedTasks.filter(t => t.status === Task_1.TaskStatus.COMPLETED).length;
            const completionRate = total ? Math.round((completed / total) * 100) : 0;
            return {
                partnerId: partnerUser.id,
                username: partnerUser.username,
                name: partnerUser.name || partnerUser.username,
                image: partnerUser.image,
                mode: r.mode,
                totalTasks: total,
                completedTasks: completed,
                completionRate
            };
        });
        return res.status(200).json({
            range,
            start,
            end,
            metrics: {
                totalTasks: tasks.length,
                completedTasks,
                completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
                totalCheckIns: checkIns.length,
                checkInConsistency: checkIns.length ? Math.round((completedCheckIns / checkIns.length) * 100) : 0,
                activityFrequency: checkIns.length,
                completedCheckIns,
                inProgressCheckIns,
                missedCheckIns,
                mutualPartnersCount,
                singlePartnersCount
            },
            activityByDay,
            workspaces: workspaceStats,
            partners: partnerStats
        });
    }
    catch (error) {
        console.error('Get analytics error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving analytics.' });
    }
};
exports.getAnalytics = getAnalytics;
