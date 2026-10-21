"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.declineInvite = exports.cancelInvite = exports.acceptInvite = exports.sendInvite = exports.listInvites = void 0;
const zod_1 = require("zod");
const Invite_1 = require("../models/Invite");
const Task_1 = require("../models/Task");
const User_1 = require("../models/User");
const notifications_1 = require("../lib/notifications");
const taskAccess_1 = require("../lib/taskAccess");
const InviteCreateSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username is required').max(20).trim(),
    taskId: zod_1.z.string().min(1, 'Task is required'),
});
const escapeRegex = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
const populateInvite = [
    { path: 'senderId', select: 'username name image' },
    { path: 'receiverId', select: 'username name image' },
    { path: 'taskId', select: 'title status dueDate ownerId creatorId visibility' },
];
const isExpired = (invite) => invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now();
const listInvites = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        await Invite_1.Invite.updateMany({ receiverId: req.user.userId, status: Invite_1.InviteStatus.PENDING, expiresAt: { $lt: new Date() } }, { status: Invite_1.InviteStatus.EXPIRED });
        const invites = await Invite_1.Invite.find({
            $or: [{ senderId: req.user.userId }, { receiverId: req.user.userId }],
        })
            .populate(populateInvite)
            .sort({ createdAt: -1 });
        return res.status(200).json({ invites: invites.map((invite) => invite.toJSON()) });
    }
    catch (error) {
        console.error('List invites error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving invites.' });
    }
};
exports.listInvites = listInvites;
const sendInvite = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    const parsed = InviteCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }
    const { username, taskId } = parsed.data;
    try {
        const [receiver, task] = await Promise.all([
            User_1.User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } }),
            Task_1.Task.findById(taskId),
        ]);
        if (!receiver) {
            return res.status(404).json({ message: 'No user found with that username.' });
        }
        if (receiver._id.toString() === req.user.userId) {
            return res.status(400).json({ message: 'You cannot invite yourself to a task.' });
        }
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        if (!(0, taskAccess_1.isTaskCreator)(task, req.user.userId)) {
            return res.status(403).json({ message: 'Only the task creator can invite collaborators.' });
        }
        if (await (0, taskAccess_1.canAccessTask)(task, receiver._id.toString())) {
            return res.status(409).json({ message: 'That user is already a collaborator on this task.' });
        }
        if (!await (0, taskAccess_1.canRelationshipMonitor)(req.user.userId, receiver._id.toString())) {
            return res.status(400).json({ message: 'Task access can only be offered to an accepted, eligible accountability partner.' });
        }
        await Invite_1.Invite.updateMany({
            senderId: req.user.userId,
            receiverId: receiver._id,
            taskId,
            status: Invite_1.InviteStatus.PENDING,
            expiresAt: { $lt: new Date() },
        }, { status: Invite_1.InviteStatus.EXPIRED });
        const duplicate = await Invite_1.Invite.findOne({
            senderId: req.user.userId,
            receiverId: receiver._id,
            taskId,
            status: Invite_1.InviteStatus.PENDING,
        });
        if (duplicate) {
            return res.status(409).json({ message: 'An active invite already exists for this user and task.' });
        }
        const invite = await Invite_1.Invite.create({
            senderId: req.user.userId,
            receiverId: receiver._id,
            taskId,
        });
        await (0, notifications_1.createNotification)({
            userId: receiver._id,
            type: 'INVITE_RECEIVED',
            title: 'New accountability invite',
            message: `@${req.user.username || 'The owner'} invited you to monitor "${task.title}". You may view and comment, but only the owner can edit or complete it.`,
            taskId,
            inviteId: invite._id,
        });
        await invite.populate(populateInvite);
        return res.status(201).json({
            message: 'Invite sent successfully.',
            invite: invite.toJSON(),
        });
    }
    catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: 'An active invite already exists for this user and task.' });
        }
        console.error('Send invite error:', error);
        return res.status(500).json({ message: 'An error occurred while sending the invite.' });
    }
};
exports.sendInvite = sendInvite;
const acceptInvite = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const invite = await Invite_1.Invite.findById(req.params.id).populate('taskId');
        if (!invite)
            return res.status(404).json({ message: 'Invite not found.' });
        if ((0, taskAccess_1.getIdString)(invite.receiverId) !== req.user.userId) {
            return res.status(403).json({ message: 'Only the invited user can accept this invite.' });
        }
        if (invite.status !== Invite_1.InviteStatus.PENDING) {
            return res.status(409).json({ message: `This invite is already ${invite.status.toLowerCase()}.` });
        }
        if (isExpired(invite)) {
            invite.status = Invite_1.InviteStatus.EXPIRED;
            await invite.save();
            return res.status(410).json({ message: 'This invite has expired.' });
        }
        const task = await Task_1.Task.findById(invite.taskId);
        if (!task)
            return res.status(404).json({ message: 'The invited task no longer exists.' });
        const receiverId = (0, taskAccess_1.getIdString)(invite.receiverId);
        if (!receiverId || !await (0, taskAccess_1.canRelationshipMonitor)(task.creatorId.toString(), receiverId)) {
            return res.status(403).json({ message: 'This accountability relationship is no longer active.' });
        }
        if (!await (0, taskAccess_1.canAccessTask)(task, receiverId)) {
            if (!task.partnerId) {
                task.partnerId = invite.receiverId;
            }
            task.collaboratorIds = Array.from(new Set([...(task.collaboratorIds || []).map((id) => id.toString()), receiverId])).map((id) => id);
            task.sharedWithIds = Array.from(new Set([...(task.sharedWithIds || []).map((id) => id.toString()), receiverId])).map((id) => id);
            task.visibility = Task_1.TaskVisibility.SELECTED_PARTNERS;
            task.isPrivate = false;
            await task.save();
        }
        invite.status = Invite_1.InviteStatus.ACCEPTED;
        invite.respondedAt = new Date();
        await invite.save();
        await (0, notifications_1.createNotification)({
            userId: invite.senderId,
            type: 'INVITE_ACCEPTED',
            title: 'Invite accepted',
            message: `Your invite for "${task.title}" was accepted.`,
            taskId: task._id,
            inviteId: invite._id,
        });
        await invite.populate(populateInvite);
        await task.populate([
            { path: 'creatorId', select: 'username name image' },
            { path: 'partnerId', select: 'username name image' },
            { path: 'collaboratorIds', select: 'username name image' },
        ]);
        return res.status(200).json({
            message: 'Invite accepted.',
            invite: invite.toJSON(),
            task: task.toJSON(),
        });
    }
    catch (error) {
        console.error('Accept invite error:', error);
        return res.status(500).json({ message: 'An error occurred while accepting the invite.' });
    }
};
exports.acceptInvite = acceptInvite;
const cancelInvite = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const invite = await Invite_1.Invite.findById(req.params.id);
        if (!invite)
            return res.status(404).json({ message: 'Invite not found.' });
        if ((0, taskAccess_1.getIdString)(invite.senderId) !== req.user.userId)
            return res.status(403).json({ message: 'Only the sender can cancel this invite.' });
        if (invite.status !== Invite_1.InviteStatus.PENDING)
            return res.status(409).json({ message: 'Only pending invites can be cancelled.' });
        invite.status = Invite_1.InviteStatus.CANCELLED;
        invite.respondedAt = new Date();
        await invite.save();
        return res.status(200).json({ message: 'Invite cancelled.', invite: invite.toJSON() });
    }
    catch (error) {
        console.error('Cancel invite error:', error);
        return res.status(500).json({ message: 'An error occurred while cancelling the invite.' });
    }
};
exports.cancelInvite = cancelInvite;
const declineInvite = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const invite = await Invite_1.Invite.findById(req.params.id).populate('taskId');
        if (!invite)
            return res.status(404).json({ message: 'Invite not found.' });
        if ((0, taskAccess_1.getIdString)(invite.receiverId) !== req.user.userId) {
            return res.status(403).json({ message: 'Only the invited user can decline this invite.' });
        }
        if (invite.status !== Invite_1.InviteStatus.PENDING) {
            return res.status(409).json({ message: `This invite is already ${invite.status.toLowerCase()}.` });
        }
        invite.status = isExpired(invite) ? Invite_1.InviteStatus.EXPIRED : Invite_1.InviteStatus.DECLINED;
        invite.respondedAt = new Date();
        await invite.save();
        const task = invite.taskId;
        await (0, notifications_1.createNotification)({
            userId: invite.senderId,
            type: 'INVITE_DECLINED',
            title: invite.status === Invite_1.InviteStatus.EXPIRED ? 'Invite expired' : 'Invite declined',
            message: `Your invite for "${task?.title || 'a task'}" was ${invite.status.toLowerCase()}.`,
            taskId: task?._id,
            inviteId: invite._id,
        });
        await invite.populate(populateInvite);
        return res.status(200).json({
            message: invite.status === Invite_1.InviteStatus.EXPIRED ? 'Invite expired.' : 'Invite declined.',
            invite: invite.toJSON(),
        });
    }
    catch (error) {
        console.error('Decline invite error:', error);
        return res.status(500).json({ message: 'An error occurred while declining the invite.' });
    }
};
exports.declineInvite = declineInvite;
