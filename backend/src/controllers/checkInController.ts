import { Response } from 'express';
import { z } from 'zod';
import { CheckIn, CheckInKind, CheckInStatus } from '../models/CheckIn';
import { Task, TaskStatus } from '../models/Task';
import { createNotification } from '../lib/notifications';
import { getTaskPermissions, getTaskParticipantIds } from '../lib/taskAccess';

const CheckInCreateSchema = z.object({
  status: z.nativeEnum(CheckInStatus),
  notes: z.string().max(1000, 'Notes are too long').trim().optional().default(''),
});

export const listCheckIns = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    if (!(await getTaskPermissions(task, req.user.userId)).canView) {
      return res.status(403).json({ message: 'You do not have permission to view check-ins for this task.' });
    }

    const checkIns = await CheckIn.find({ taskId: task._id })
      .populate('userId', 'username name image')
      .sort({ createdAt: -1 });

    return res.status(200).json({ checkIns: checkIns.map((checkIn) => checkIn.toJSON()) });
  } catch (error) {
    console.error('List check-ins error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving check-ins.' });
  }
};

export const createCheckIn = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  const parsed = CheckInCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  }

  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canComment) {
      return res.status(403).json({ message: 'Only task collaborators can submit check-ins.' });
    }

    if (!permissions.isOwner && parsed.data.status === CheckInStatus.COMPLETED) {
      return res.status(403).json({ message: 'Only the task owner can mark this task completed.' });
    }

    const checkIn = await CheckIn.create({
      taskId: task._id,
      userId: req.user.userId,
      status: parsed.data.status,
      notes: parsed.data.notes,
      kind: permissions.isOwner ? CheckInKind.OWNER_PROGRESS : CheckInKind.PARTNER_FEEDBACK,
    });

    // A monitor's record is feedback only and never mutates owner progress.
    if (permissions.isOwner && parsed.data.status === CheckInStatus.COMPLETED) {
      task.status = TaskStatus.COMPLETED;
      await task.save();
    } else if (permissions.isOwner && parsed.data.status === CheckInStatus.MISSED) {
      task.status = TaskStatus.MISSED;
      await task.save();
    } else if (permissions.isOwner && task.status !== TaskStatus.COMPLETED) {
      task.status = TaskStatus.IN_PROGRESS;
      await task.save();
    }

    const otherParticipantIds = getTaskParticipantIds(task).filter((id) => id !== req.user.userId);
    await Promise.all(otherParticipantIds.map((userId) => createNotification({
      userId,
      type: 'CHECK_IN_SUBMITTED',
      title: 'New check-in',
      message: permissions.isOwner
        ? `The owner posted a ${parsed.data.status.toLowerCase().replace('_', ' ')} progress update on "${task.title}".`
        : `An accountability partner left feedback on "${task.title}".`,
      taskId: task._id,
    })));

    await checkIn.populate('userId', 'username name image');

    return res.status(201).json({
      message: 'Check-in submitted.',
      checkIn: checkIn.toJSON(),
    });
  } catch (error) {
    console.error('Create check-in error:', error);
    return res.status(500).json({ message: 'An error occurred while submitting the check-in.' });
  }
};
