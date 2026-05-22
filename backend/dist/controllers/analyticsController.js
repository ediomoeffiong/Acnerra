"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = void 0;
const CheckIn_1 = require("../models/CheckIn");
const Task_1 = require("../models/Task");
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
    try {
        const tasks = await Task_1.Task.find({
            $or: [{ creatorId: req.user.userId }, { partnerId: req.user.userId }, { collaboratorIds: req.user.userId }],
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
            },
            activityByDay,
        });
    }
    catch (error) {
        console.error('Get analytics error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving analytics.' });
    }
};
exports.getAnalytics = getAnalytics;
