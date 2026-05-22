import { Response } from 'express';
import { z } from 'zod';
import { Invite, InviteStatus } from '../models/Invite';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { createNotification } from '../lib/notifications';
import { canAccessTask, getIdString, isTaskCreator } from '../lib/taskAccess';

const InviteCreateSchema = z.object({
  username: z.string().min(3, 'Username is required').max(20).trim(),
  taskId: z.string().min(1, 'Task is required'),
});

const populateInvite = [
  { path: 'senderId', select: 'username name image' },
  { path: 'receiverId', select: 'username name image' },
  { path: 'taskId', select: 'title status dueDate' },
];

const isExpired = (invite: any) => invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now();

export const listInvites = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    await Invite.updateMany(
      { receiverId: req.user.userId, status: InviteStatus.PENDING, expiresAt: { $lt: new Date() } },
      { status: InviteStatus.EXPIRED }
    );

    const invites = await Invite.find({
      $or: [{ senderId: req.user.userId }, { receiverId: req.user.userId }],
    })
      .populate(populateInvite)
      .sort({ createdAt: -1 });

    return res.status(200).json({ invites: invites.map((invite) => invite.toJSON()) });
  } catch (error) {
    console.error('List invites error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving invites.' });
  }
};

export const sendInvite = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const parsed = InviteCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  const { username, taskId } = parsed.data;

  try {
    const [receiver, task] = await Promise.all([
      User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } }),
      Task.findById(taskId),
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

    if (!isTaskCreator(task, req.user.userId)) {
      return res.status(403).json({ message: 'Only the task creator can invite collaborators.' });
    }

    if (canAccessTask(task, receiver._id.toString())) {
      return res.status(409).json({ message: 'That user is already a collaborator on this task.' });
    }

    await Invite.updateMany(
      {
        senderId: req.user.userId,
        receiverId: receiver._id,
        taskId,
        status: InviteStatus.PENDING,
        expiresAt: { $lt: new Date() },
      },
      { status: InviteStatus.EXPIRED }
    );

    const duplicate = await Invite.findOne({
      senderId: req.user.userId,
      receiverId: receiver._id,
      taskId,
      status: InviteStatus.PENDING,
    });

    if (duplicate) {
      return res.status(409).json({ message: 'An active invite already exists for this user and task.' });
    }

    const invite = await Invite.create({
      senderId: req.user.userId,
      receiverId: receiver._id,
      taskId,
    });

    await createNotification({
      userId: receiver._id,
      type: 'INVITE_RECEIVED',
      title: 'New accountability invite',
      message: `You were invited to collaborate on "${task.title}".`,
      taskId,
      inviteId: invite._id,
    });

    await invite.populate(populateInvite);

    return res.status(201).json({
      message: 'Invite sent successfully.',
      invite: invite.toJSON(),
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'An active invite already exists for this user and task.' });
    }

    console.error('Send invite error:', error);
    return res.status(500).json({ message: 'An error occurred while sending the invite.' });
  }
};

export const acceptInvite = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const invite = await Invite.findById(req.params.id).populate('taskId');
    if (!invite) return res.status(404).json({ message: 'Invite not found.' });

    if (getIdString(invite.receiverId) !== req.user.userId) {
      return res.status(403).json({ message: 'Only the invited user can accept this invite.' });
    }

    if (invite.status !== InviteStatus.PENDING) {
      return res.status(409).json({ message: `This invite is already ${invite.status.toLowerCase()}.` });
    }

    if (isExpired(invite)) {
      invite.status = InviteStatus.EXPIRED;
      await invite.save();
      return res.status(410).json({ message: 'This invite has expired.' });
    }

    const task = await Task.findById(invite.taskId);
    if (!task) return res.status(404).json({ message: 'The invited task no longer exists.' });

    const receiverId = getIdString(invite.receiverId);
    if (receiverId && !canAccessTask(task, receiverId)) {
      if (!task.partnerId) {
        task.partnerId = invite.receiverId as any;
      }
      task.collaboratorIds = Array.from(new Set([...(task.collaboratorIds || []).map((id: any) => id.toString()), receiverId])).map((id) => id as any);
      await task.save();
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.respondedAt = new Date();
    await invite.save();

    await createNotification({
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
  } catch (error) {
    console.error('Accept invite error:', error);
    return res.status(500).json({ message: 'An error occurred while accepting the invite.' });
  }
};

export const declineInvite = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const invite = await Invite.findById(req.params.id).populate('taskId');
    if (!invite) return res.status(404).json({ message: 'Invite not found.' });

    if (getIdString(invite.receiverId) !== req.user.userId) {
      return res.status(403).json({ message: 'Only the invited user can decline this invite.' });
    }

    if (invite.status !== InviteStatus.PENDING) {
      return res.status(409).json({ message: `This invite is already ${invite.status.toLowerCase()}.` });
    }

    invite.status = isExpired(invite) ? InviteStatus.EXPIRED : InviteStatus.DECLINED;
    invite.respondedAt = new Date();
    await invite.save();

    const task = invite.taskId as any;
    await createNotification({
      userId: invite.senderId,
      type: 'INVITE_DECLINED',
      title: invite.status === InviteStatus.EXPIRED ? 'Invite expired' : 'Invite declined',
      message: `Your invite for "${task?.title || 'a task'}" was ${invite.status.toLowerCase()}.`,
      taskId: task?._id,
      inviteId: invite._id,
    });

    await invite.populate(populateInvite);

    return res.status(200).json({
      message: invite.status === InviteStatus.EXPIRED ? 'Invite expired.' : 'Invite declined.',
      invite: invite.toJSON(),
    });
  } catch (error) {
    console.error('Decline invite error:', error);
    return res.status(500).json({ message: 'An error occurred while declining the invite.' });
  }
};
