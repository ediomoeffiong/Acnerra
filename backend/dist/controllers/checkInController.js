"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadEvidenceFile = exports.uploadEvidenceFile = exports.createCheckIn = exports.listCheckIns = void 0;
const zod_1 = require("zod");
const CheckIn_1 = require("../models/CheckIn");
const Task_1 = require("../models/Task");
const notifications_1 = require("../lib/notifications");
const Notification_1 = require("../models/Notification");
const taskAccess_1 = require("../lib/taskAccess");
const gamification_1 = require("../lib/gamification");
const XPTransaction_1 = require("../models/XPTransaction");
const storage_1 = require("../lib/storage");
const EvidenceInputSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    type: zod_1.z.nativeEnum(CheckIn_1.EvidenceType),
    url: zod_1.z.string().min(1).max(2000),
    name: zod_1.z.string().min(1).max(200),
    size: zod_1.z.number().optional(),
    mimeType: zod_1.z.string().optional(),
    storageKey: zod_1.z.string().optional(),
});
const CheckInCreateSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(CheckIn_1.CheckInStatus),
    notes: zod_1.z.string().max(2000, 'Notes are too long').trim().optional().default(''),
    progress: zod_1.z.number().min(0).max(100).optional().nullable(),
    completedWork: zod_1.z.string().max(2000).trim().optional().default(''),
    blockers: zod_1.z.string().max(2000).trim().optional().default(''),
    nextSteps: zod_1.z.string().max(2000).trim().optional().default(''),
    isPrivate: zod_1.z.boolean().optional().default(false),
    evidence: zod_1.z.array(EvidenceInputSchema).optional().default([]),
});
const listCheckIns = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const task = await Task_1.Task.findById(req.params.taskId);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        const permissions = await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId);
        if (!permissions.canView) {
            return res.status(403).json({ message: 'You do not have permission to view check-ins for this task.' });
        }
        const checkIns = await CheckIn_1.CheckIn.find({ taskId: task._id })
            .populate('userId', 'username name image')
            .sort({ createdAt: -1 });
        // Filter out private feedback that doesn't belong to the current viewer or if current viewer is not the task owner
        const visibleCheckIns = checkIns.filter((checkIn) => {
            if (!checkIn.isPrivate)
                return true;
            if (permissions.isOwner)
                return true;
            return checkIn.userId?._id?.toString() === req.user.userId;
        });
        return res.status(200).json({ checkIns: visibleCheckIns.map((checkIn) => checkIn.toJSON()) });
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
        const permissions = await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId);
        if (!permissions.canComment) {
            return res.status(403).json({ message: 'Only task collaborators can submit check-ins.' });
        }
        if (!permissions.isOwner && parsed.data.status === CheckIn_1.CheckInStatus.COMPLETED) {
            return res.status(403).json({ message: 'Only the task owner can mark this task completed.' });
        }
        const kind = permissions.isOwner ? CheckIn_1.CheckInKind.OWNER_PROGRESS : CheckIn_1.CheckInKind.PARTNER_FEEDBACK;
        const checkIn = await CheckIn_1.CheckIn.create({
            taskId: task._id,
            userId: req.user.userId,
            status: parsed.data.status,
            notes: parsed.data.notes,
            kind,
            progress: parsed.data.progress,
            completedWork: parsed.data.completedWork,
            blockers: parsed.data.blockers,
            nextSteps: parsed.data.nextSteps,
            isPrivate: !permissions.isOwner && parsed.data.isPrivate,
            evidence: (parsed.data.evidence || []).map((e, idx) => ({ ...e, id: e.id || `ev_${Date.now()}_${idx}` })),
        });
        // A monitor's record is feedback only and never mutates owner progress.
        if (permissions.isOwner) {
            if (parsed.data.progress !== undefined && parsed.data.progress !== null) {
                task.manualProgress = parsed.data.progress;
            }
            if (parsed.data.status === CheckIn_1.CheckInStatus.COMPLETED) {
                task.status = Task_1.TaskStatus.COMPLETED;
            }
            else if (parsed.data.status === CheckIn_1.CheckInStatus.MISSED) {
                task.status = Task_1.TaskStatus.MISSED;
            }
            else if (task.status !== Task_1.TaskStatus.COMPLETED) {
                task.status = Task_1.TaskStatus.IN_PROGRESS;
            }
            await task.save();
            // Award XP for progress update
            await (0, gamification_1.awardXP)(req.user.userId, XPTransaction_1.XPReason.CHECK_IN_SUBMITTED, checkIn._id.toString());
            await (0, gamification_1.evaluateAchievements)(req.user.userId);
        }
        // Notifications
        if (permissions.isOwner) {
            const otherParticipantIds = (0, taskAccess_1.getTaskParticipantIds)(task).filter((id) => id !== req.user.userId);
            await Promise.all(otherParticipantIds.map((userId) => (0, notifications_1.createNotification)({
                userId,
                type: 'CHECK_IN_SUBMITTED',
                category: Notification_1.NotificationCategory.FEEDBACK,
                title: 'New progress update',
                message: `The owner posted a progress update on "${task.title}".`,
                taskId: task._id,
            })));
        }
        else {
            // Partner feedback: notify owner
            await (0, notifications_1.createNotification)({
                userId: task.ownerId,
                type: 'PARTNER_FEEDBACK',
                category: Notification_1.NotificationCategory.FEEDBACK,
                priority: Notification_1.NotificationPriority.NORMAL,
                title: parsed.data.isPrivate ? 'Private feedback from partner' : 'New partner feedback',
                message: `Your partner left feedback on "${task.title}".`,
                taskId: task._id,
            });
        }
        await checkIn.populate('userId', 'username name image');
        return res.status(201).json({
            message: 'Check-in submitted successfully.',
            checkIn: checkIn.toJSON(),
        });
    }
    catch (error) {
        console.error('Create check-in error:', error);
        return res.status(500).json({ message: 'An error occurred while submitting the check-in.' });
    }
};
exports.createCheckIn = createCheckIn;
// Evidence file upload endpoint (Phase 5)
const uploadEvidenceFile = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    if (!req.file)
        return res.status(400).json({ message: 'No file uploaded.' });
    try {
        const task = await Task_1.Task.findById(req.params.taskId);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        const permissions = await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId);
        if (!permissions.canComment) {
            return res.status(403).json({ message: 'You do not have permission to attach evidence to this task.' });
        }
        const { buffer, originalname, mimetype } = req.file;
        const saved = await (0, storage_1.saveEvidenceFile)(buffer, originalname, mimetype);
        const type = mimetype.startsWith('image/') ? CheckIn_1.EvidenceType.IMAGE : CheckIn_1.EvidenceType.DOCUMENT;
        const downloadUrl = `/api/v1/tasks/${task._id}/evidence/${saved.storageKey}/download`;
        return res.status(201).json({
            message: 'File uploaded successfully.',
            evidence: {
                id: `ev_${Date.now()}`,
                type,
                url: downloadUrl,
                name: saved.filename,
                size: saved.size,
                mimeType: mimetype,
                storageKey: saved.storageKey,
            },
        });
    }
    catch (error) {
        console.error('Upload evidence error:', error);
        return res.status(400).json({ message: error.message || 'File upload failed.' });
    }
};
exports.uploadEvidenceFile = uploadEvidenceFile;
// Authenticated Evidence Download (Phase 5)
const downloadEvidenceFile = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const task = await Task_1.Task.findById(req.params.taskId);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        const permissions = await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId);
        if (!permissions.canView) {
            return res.status(403).json({ message: 'You do not have permission to access files from this task.' });
        }
        const filePath = (0, storage_1.getEvidenceFilePath)(req.params.storageKey);
        if (!filePath) {
            return res.status(404).json({ message: 'Requested file was not found.' });
        }
        return res.sendFile(filePath);
    }
    catch (error) {
        console.error('Download evidence error:', error);
        return res.status(500).json({ message: 'An error occurred while downloading file.' });
    }
};
exports.downloadEvidenceFile = downloadEvidenceFile;
