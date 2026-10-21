import { Response } from 'express';
import { z } from 'zod';
import { CheckIn, CheckInKind, CheckInStatus, EvidenceType } from '../models/CheckIn';
import { Task, TaskStatus } from '../models/Task';
import { createNotification } from '../lib/notifications';
import { NotificationCategory, NotificationPriority } from '../models/Notification';
import { getTaskPermissions, getTaskParticipantIds } from '../lib/taskAccess';
import { awardXP, evaluateAchievements } from '../lib/gamification';
import { XPReason } from '../models/XPTransaction';
import { saveEvidenceFile, getEvidenceFilePath } from '../lib/storage';

const EvidenceInputSchema = z.object({
  id: z.string().optional(),
  type: z.nativeEnum(EvidenceType),
  url: z.string().min(1).max(2000),
  name: z.string().min(1).max(200),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  storageKey: z.string().optional(),
});

const CheckInCreateSchema = z.object({
  status: z.nativeEnum(CheckInStatus),
  notes: z.string().max(2000, 'Notes are too long').trim().optional().default(''),
  progress: z.number().min(0).max(100).optional().nullable(),
  completedWork: z.string().max(2000).trim().optional().default(''),
  blockers: z.string().max(2000).trim().optional().default(''),
  nextSteps: z.string().max(2000).trim().optional().default(''),
  isPrivate: z.boolean().optional().default(false),
  evidence: z.array(EvidenceInputSchema).optional().default([]),
});

export const listCheckIns = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canView) {
      return res.status(403).json({ message: 'You do not have permission to view check-ins for this task.' });
    }

    const checkIns = await CheckIn.find({ taskId: task._id })
      .populate('userId', 'username name image')
      .sort({ createdAt: -1 });

    // Filter out private feedback that doesn't belong to the current viewer or if current viewer is not the task owner
    const visibleCheckIns = checkIns.filter((checkIn: any) => {
      if (!checkIn.isPrivate) return true;
      if (permissions.isOwner) return true;
      return checkIn.userId?._id?.toString() === req.user.userId;
    });

    return res.status(200).json({ checkIns: visibleCheckIns.map((checkIn) => checkIn.toJSON()) });
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
    const task: any = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canComment) {
      return res.status(403).json({ message: 'Only task collaborators can submit check-ins.' });
    }

    if (!permissions.isOwner && parsed.data.status === CheckInStatus.COMPLETED) {
      return res.status(403).json({ message: 'Only the task owner can mark this task completed.' });
    }

    const kind = permissions.isOwner ? CheckInKind.OWNER_PROGRESS : CheckInKind.PARTNER_FEEDBACK;

    const checkIn = await CheckIn.create({
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
      if (parsed.data.status === CheckInStatus.COMPLETED) {
        task.status = TaskStatus.COMPLETED;
      } else if (parsed.data.status === CheckInStatus.MISSED) {
        task.status = TaskStatus.MISSED;
      } else if (task.status !== TaskStatus.COMPLETED) {
        task.status = TaskStatus.IN_PROGRESS;
      }
      await task.save();

      // Award XP for progress update
      await awardXP(req.user.userId, XPReason.CHECK_IN_SUBMITTED, checkIn._id.toString());
      await evaluateAchievements(req.user.userId);
    }

    // Notifications
    if (permissions.isOwner) {
      const otherParticipantIds = getTaskParticipantIds(task).filter((id) => id !== req.user.userId);
      await Promise.all(otherParticipantIds.map((userId) => createNotification({
        userId,
        type: 'CHECK_IN_SUBMITTED',
        category: NotificationCategory.FEEDBACK,
        title: 'New progress update',
        message: `The owner posted a progress update on "${task.title}".`,
        taskId: task._id,
      })));
    } else {
      // Partner feedback: notify owner
      await createNotification({
        userId: task.ownerId,
        type: 'PARTNER_FEEDBACK',
        category: NotificationCategory.FEEDBACK,
        priority: NotificationPriority.NORMAL,
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
  } catch (error) {
    console.error('Create check-in error:', error);
    return res.status(500).json({ message: 'An error occurred while submitting the check-in.' });
  }
};

// Evidence file upload endpoint (Phase 5)
export const uploadEvidenceFile = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canComment) {
      return res.status(403).json({ message: 'You do not have permission to attach evidence to this task.' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const saved = await saveEvidenceFile(buffer, originalname, mimetype);

    const type = mimetype.startsWith('image/') ? EvidenceType.IMAGE : EvidenceType.DOCUMENT;
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
  } catch (error: any) {
    console.error('Upload evidence error:', error);
    return res.status(400).json({ message: error.message || 'File upload failed.' });
  }
};

// Authenticated Evidence Download (Phase 5)
export const downloadEvidenceFile = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canView) {
      return res.status(403).json({ message: 'You do not have permission to access files from this task.' });
    }

    const filePath = getEvidenceFilePath(req.params.storageKey);
    if (!filePath) {
      return res.status(404).json({ message: 'Requested file was not found.' });
    }

    return res.sendFile(filePath);
  } catch (error) {
    console.error('Download evidence error:', error);
    return res.status(500).json({ message: 'An error occurred while downloading file.' });
  }
};
