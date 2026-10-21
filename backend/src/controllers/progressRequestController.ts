import { Response } from 'express';
import { z } from 'zod';
import { ProgressRequest, ProgressRequestStatus } from '../models/ProgressRequest';
import { Task } from '../models/Task';
import { getTaskPermissions, getTaskOwnerId } from '../lib/taskAccess';
import { createNotification } from '../lib/notifications';
import { NotificationCategory, NotificationPriority } from '../models/Notification';

export const createProgressRequest = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const schema = z.object({
    message: z.string().max(300).trim().optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const permissions = await getTaskPermissions(task, req.user.userId);
    if (permissions.role !== 'MONITOR') {
      return res.status(403).json({ message: 'Only active accountability partners monitoring this task can request progress updates.' });
    }

    const ownerId = getTaskOwnerId(task)!;

    // Check if muted by owner
    const muted = await ProgressRequest.findOne({
      taskId: task._id,
      requesterId: req.user.userId,
      status: ProgressRequestStatus.MUTED,
    });
    if (muted) {
      return res.status(403).json({ message: 'Progress update requests have been muted for this task.' });
    }

    // 1. One outstanding request per partner-task pair rule
    const outstanding = await ProgressRequest.findOne({
      taskId: task._id,
      requesterId: req.user.userId,
      status: ProgressRequestStatus.PENDING,
    });
    if (outstanding) {
      return res.status(400).json({ message: 'You already have an outstanding progress request for this task.' });
    }

    // 2. 24-hour cooldown rule
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequest = await ProgressRequest.findOne({
      taskId: task._id,
      requesterId: req.user.userId,
      requestedAt: { $gte: twentyFourHoursAgo },
    });
    if (recentRequest) {
      return res.status(429).json({ message: 'Please wait 24 hours between progress update requests on this task.' });
    }

    const progressRequest = await ProgressRequest.create({
      taskId: task._id,
      ownerId,
      requesterId: req.user.userId,
      status: ProgressRequestStatus.PENDING,
      message: parsed.data.message || 'How is this commitment progressing? An update would be appreciated!',
      requestedAt: new Date(),
    });

    await progressRequest.populate('requesterId', 'username name image');

    await createNotification({
      userId: ownerId,
      type: 'PROGRESS_REQUEST',
      category: NotificationCategory.REMINDERS,
      priority: NotificationPriority.HIGH,
      title: 'Progress Update Requested',
      message: `${(progressRequest.requesterId as any)?.name || (progressRequest.requesterId as any)?.username} requested a progress update on "${task.title}".`,
      taskId: task._id,
      progressRequestId: progressRequest._id,
    });

    return res.status(201).json({
      message: 'Progress update requested.',
      progressRequest: progressRequest.toJSON(),
    });
  } catch (error) {
    console.error('Create progress request error:', error);
    return res.status(500).json({ message: 'An error occurred while creating progress request.' });
  }
};

export const listProgressRequests = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canView) {
      return res.status(403).json({ message: 'You do not have permission to view requests for this task.' });
    }

    const requests = await ProgressRequest.find({ taskId: task._id })
      .populate('requesterId', 'username name image')
      .sort({ requestedAt: -1 });

    return res.status(200).json({ progressRequests: requests.map((r) => r.toJSON()) });
  } catch (error) {
    console.error('List progress requests error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving progress requests.' });
  }
};

export const respondToProgressRequest = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const schema = z.object({
    responseNotes: z.string().max(1000).trim().optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const progressRequest: any = await ProgressRequest.findById(req.params.requestId);
    if (!progressRequest) return res.status(404).json({ message: 'Progress request not found.' });

    if (progressRequest.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the task owner can respond to this progress request.' });
    }

    progressRequest.status = ProgressRequestStatus.RESPONDED;
    progressRequest.respondedAt = new Date();
    progressRequest.responseNotes = parsed.data.responseNotes;
    await progressRequest.save();

    await createNotification({
      userId: progressRequest.requesterId,
      type: 'PROGRESS_REQUEST_RESPONDED',
      category: NotificationCategory.FEEDBACK,
      title: 'Progress Request Answered',
      message: `The owner responded to your progress request.`,
      taskId: progressRequest.taskId,
      progressRequestId: progressRequest._id,
    });

    return res.status(200).json({ message: 'Responded to progress request.', progressRequest: progressRequest.toJSON() });
  } catch (error) {
    console.error('Respond to progress request error:', error);
    return res.status(500).json({ message: 'An error occurred while responding to progress request.' });
  }
};

export const muteProgressRequest = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const progressRequest: any = await ProgressRequest.findById(req.params.requestId);
    if (!progressRequest) return res.status(404).json({ message: 'Progress request not found.' });

    if (progressRequest.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the task owner can mute progress requests.' });
    }

    progressRequest.status = ProgressRequestStatus.MUTED;
    await progressRequest.save();

    return res.status(200).json({ message: 'Progress requests muted from this partner for this task.' });
  } catch (error) {
    console.error('Mute progress request error:', error);
    return res.status(500).json({ message: 'An error occurred while muting progress request.' });
  }
};
