"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckIn = exports.listCheckIns = void 0;
const zod_1 = require("zod");
const CheckIn_1 = require("../models/CheckIn");
const Task_1 = require("../models/Task");
const notifications_1 = require("../lib/notifications");
const taskAccess_1 = require("../lib/taskAccess");
const CheckInCreateSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(CheckIn_1.CheckInStatus),
    notes: zod_1.z.string().max(1000, 'Notes are too long').trim().optional().default(''),
});
const listCheckIns = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const task = await Task_1.Task.findById(req.params.taskId);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        if (!(0, taskAccess_1.canAccessTask)(task, req.user.userId)) {
            return res.status(403).json({ message: 'You do not have permission to view check-ins for this task.' });
        }
        const checkIns = await CheckIn_1.CheckIn.find({ taskId: task._id })
            .populate('userId', 'username name image')
            .sort({ createdAt: -1 });
        return res.status(200).json({ checkIns: checkIns.map((checkIn) => checkIn.toJSON()) });
    }
    catch (error) {
        console.error('List check-ins error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving check-ins.' });
    }
};
exports.listCheckIns = listCheckIns;
const createCheckIn = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    const parsed = CheckInCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }
    try {
        const task = await Task_1.Task.findById(req.params.taskId);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        if (!(0, taskAccess_1.canAccessTask)(task, req.user.userId)) {
            return res.status(403).json({ message: 'Only task collaborators can submit check-ins.' });
        }
        const checkIn = await CheckIn_1.CheckIn.create({
            taskId: task._id,
            userId: req.user.userId,
            status: parsed.data.status,
            notes: parsed.data.notes,
        });
        if (parsed.data.status === CheckIn_1.CheckInStatus.COMPLETED) {
            task.status = Task_1.TaskStatus.COMPLETED;
            await task.save();
        }
        const otherParticipantIds = (0, taskAccess_1.getTaskParticipantIds)(task).filter((id) => id !== req.user.userId);
        await Promise.all(otherParticipantIds.map((userId) => (0, notifications_1.createNotification)({
            userId,
            type: 'CHECK_IN_SUBMITTED',
            title: 'New check-in',
            message: `A collaborator posted a ${parsed.data.status.toLowerCase().replace('_', ' ')} check-in on "${task.title}".`,
            taskId: task._id,
        })));
        await checkIn.populate('userId', 'username name image');
        return res.status(201).json({
            message: 'Check-in submitted.',
            checkIn: checkIn.toJSON(),
        });
    }
    catch (error) {
        console.error('Create check-in error:', error);
        return res.status(500).json({ message: 'An error occurred while submitting the check-in.' });
    }
};
exports.createCheckIn = createCheckIn;
