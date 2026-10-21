import { Response } from 'express';
import { z } from 'zod';
import { Task, TaskPriority, TaskStatus, TaskVisibility, ProgressMode, RecurrenceFrequency, VerificationStatus, MilestoneStatus } from '../models/Task';
import { CheckIn, CheckInKind } from '../models/CheckIn';
import { Workspace } from '../models/Workspace';
import { Invite, InviteStatus } from '../models/Invite';
import { ProgressRequest, ProgressRequestStatus } from '../models/ProgressRequest';
import { User } from '../models/User';
import { createNotification } from '../lib/notifications';
import { NotificationCategory, NotificationPriority } from '../models/Notification';
import { awardXP, evaluateAchievements } from '../lib/gamification';
import { XPReason } from '../models/XPTransaction';
import { generateNextOccurrence } from '../lib/recurrence';
import {
  getEligibleMonitorIds,
  getExplicitMonitorIds,
  getIdString,
  getTaskOwnerId,
  getTaskParticipantIds,
  getTaskPermissions,
} from '../lib/taskAccess';

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');
const dueDateField = z.string().nullable().optional().transform((value, ctx) => {
  if (value === undefined || value === null || value === '') return value === undefined ? undefined : null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Invalid due date' });
    return z.NEVER;
  }
  return parsed;
});

const SubtaskInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(1000).trim().optional().default(''),
  dueDate: dueDateField,
  order: z.number().int().optional().default(0),
});

const MilestoneInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(1000).trim().optional().default(''),
  targetDate: dueDateField,
  status: z.nativeEnum(MilestoneStatus).optional().default(MilestoneStatus.PENDING),
  linkedSubtaskIds: z.array(objectIdString).optional().default([]),
  order: z.number().int().optional().default(0),
});

const RecurrenceInputSchema = z.object({
  frequency: z.nativeEnum(RecurrenceFrequency).optional().default(RecurrenceFrequency.NONE),
  interval: z.number().int().min(1).max(365).optional().default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
  endDate: dueDateField,
  count: z.number().int().min(1).max(1000).nullable().optional(),
  timezone: z.string().optional().default('UTC'),
});

const TaskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100).trim(),
  description: z.string().max(1000).trim().optional().default(''),
  status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.PENDING),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
  dueDate: dueDateField,
  workspaceId: objectIdString.nullable().optional(),
  visibility: z.nativeEnum(TaskVisibility).optional().default(TaskVisibility.PRIVATE),
  sharedWithIds: z.array(objectIdString).max(100).optional().default([]),
  isPrivate: z.boolean().optional(),
  partnerId: z.null().optional(),
  collaboratorIds: z.array(objectIdString).max(100).optional(),
  // Stage 2 additions
  subtasks: z.array(SubtaskInputSchema).optional().default([]),
  milestones: z.array(MilestoneInputSchema).optional().default([]),
  progressMode: z.nativeEnum(ProgressMode).optional().default(ProgressMode.AUTO),
  manualProgress: z.number().min(0).max(100).optional().default(0),
  recurrence: RecurrenceInputSchema.optional(),
  verificationRequired: z.boolean().optional().default(false),
  verifierId: objectIdString.nullable().optional(),
}).strict();

const TaskUpdateSchema = z.object({
  title: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: dueDateField,
  workspaceId: objectIdString.nullable().optional(),
  visibility: z.nativeEnum(TaskVisibility).optional(),
  sharedWithIds: z.array(objectIdString).max(100).optional(),
  isPrivate: z.boolean().optional(),
  partnerId: z.null().optional(),
  // Stage 2 additions
  progressMode: z.nativeEnum(ProgressMode).optional(),
  manualProgress: z.number().min(0).max(100).optional(),
  recurrence: RecurrenceInputSchema.optional(),
  verificationRequired: z.boolean().optional(),
  verifierId: objectIdString.nullable().optional(),
  editScope: z.enum(['THIS_INSTANCE', 'FUTURE_INSTANCES', 'ALL_INSTANCES']).optional().default('THIS_INSTANCE'),
}).strict();

const taskPopulate = [
  { path: 'ownerId', select: 'username name image xp level' },
  { path: 'creatorId', select: 'username name image xp level' },
  { path: 'partnerId', select: 'username name image' },
  { path: 'collaboratorIds', select: 'username name image' },
  { path: 'sharedWithIds', select: 'username name image' },
  { path: 'verifierId', select: 'username name image' },
];

const taskCandidateQuery = (userId: string) => ({
  $or: [
    { ownerId: userId },
    { ownerId: null, creatorId: userId },
    { sharedWithIds: userId },
    { partnerId: userId },
    { collaboratorIds: userId },
    { visibility: TaskVisibility.WORKSPACE },
  ],
});

const validateFutureDueDate = (date?: Date | null) => !date || date.getTime() > Date.now();

const validateOwnedWorkspace = async (workspaceId: string | null | undefined, ownerId: string) => {
  if (!workspaceId) return true;
  return Boolean(await Workspace.exists({ _id: workspaceId, userId: ownerId }));
};

const validateSharedMonitors = async (ownerId: string, requested: string[]) => {
  const unique = Array.from(new Set(requested)).filter((id) => id !== ownerId);
  const eligible = new Set(await getEligibleMonitorIds(ownerId));
  return { valid: unique.every((id) => eligible.has(id)), ids: unique };
};

const serializeTask = (task: any, permissions: any) => ({
  ...task.toJSON(),
  permissions,
  role: permissions.role,
});

export const createTask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const parsed = TaskCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const ownerId = req.user.userId;
    const input = parsed.data;
    if (!validateFutureDueDate(input.dueDate)) return res.status(400).json({ message: 'Target due date must be in the future.' });
    if (!await validateOwnedWorkspace(input.workspaceId, ownerId)) {
      return res.status(403).json({ message: 'You can only place a task in a workspace you own.' });
    }

    const requestedIds = input.sharedWithIds.length ? input.sharedWithIds : (input.collaboratorIds || []);
    const shared = await validateSharedMonitors(ownerId, requestedIds);
    if (!shared.valid) return res.status(400).json({ message: 'One or more selected users are not eligible accountability partners.' });

    if (input.verifierId) {
      const eligible = new Set(await getEligibleMonitorIds(ownerId));
      if (!eligible.has(input.verifierId)) {
        return res.status(400).json({ message: 'Selected verifier is not an active accountability partner.' });
      }
    }

    let visibility = input.visibility;
    if (input.isPrivate === true || (shared.ids.length === 0 && visibility === TaskVisibility.SELECTED_PARTNERS)) {
      visibility = TaskVisibility.PRIVATE;
    }
    if (shared.ids.length > 0 && visibility === TaskVisibility.PRIVATE && input.isPrivate !== true) {
      visibility = TaskVisibility.SELECTED_PARTNERS;
    }
    if (visibility === TaskVisibility.WORKSPACE && !input.workspaceId) {
      return res.status(400).json({ message: 'Workspace visibility requires a workspace.' });
    }

    const duplicate = input.status !== TaskStatus.COMPLETED && await Task.findOne({
      $or: [{ ownerId }, { ownerId: null, creatorId: ownerId }],
      status: { $ne: TaskStatus.COMPLETED },
      title: { $regex: new RegExp(`^${input.title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
    });
    if (duplicate) return res.status(409).json({ message: 'An active task with this title already exists.' });

    const effectiveShares = visibility === TaskVisibility.PRIVATE ? [] : shared.ids;
    const task = await Task.create({
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate || null,
      ownerId,
      creatorId: ownerId,
      visibility,
      isPrivate: visibility === TaskVisibility.PRIVATE,
      sharedWithIds: effectiveShares,
      collaboratorIds: effectiveShares,
      partnerId: effectiveShares[0] || null,
      workspaceId: input.workspaceId || null,
      subtasks: input.subtasks.map((s, idx) => ({ ...s, order: s.order ?? idx })),
      milestones: input.milestones.map((m, idx) => ({ ...m, order: m.order ?? idx })),
      progressMode: input.progressMode,
      manualProgress: input.manualProgress,
      recurrence: input.recurrence || { frequency: RecurrenceFrequency.NONE, interval: 1, daysOfWeek: [] },
      verificationRequired: input.verificationRequired,
      verifierId: input.verifierId || null,
      verificationStatus: (input.verificationRequired && input.status === TaskStatus.COMPLETED)
        ? VerificationStatus.PENDING
        : VerificationStatus.NOT_REQUESTED,
    });

    // Check achievements
    await evaluateAchievements(ownerId);

    await Promise.all(effectiveShares.map((userId) => createNotification({
      userId,
      type: 'TASK_UPDATED',
      category: NotificationCategory.TASKS,
      title: 'Task shared with you',
      message: `You can now monitor "${task.title}". The owner remains responsible for completing it.`,
      taskId: task._id,
    })));

    await task.populate(taskPopulate);
    return res.status(201).json({ message: 'Task created successfully', task: serializeTask(task, await getTaskPermissions(task, ownerId)) });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ message: 'An error occurred while creating the task.' });
  }
};

export const getTasks = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const query: any = taskCandidateQuery(req.user.userId);
    if (req.query.workspaceId !== undefined) {
      query.workspaceId = ['null', 'none'].includes(req.query.workspaceId) ? null : req.query.workspaceId;
    }
    const candidates = await Task.find(query).populate(taskPopulate).sort({ createdAt: -1 });
    const permissions = await Promise.all(candidates.map((task) => getTaskPermissions(task, req.user.userId)));
    const tasks = candidates.flatMap((task, index) => permissions[index].canView ? [serializeTask(task, permissions[index])] : []);
    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving tasks.' });
  }
};

export const getTaskById = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task = await Task.findById(req.params.id).populate(taskPopulate);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canView) return res.status(403).json({ message: 'You do not have permission to view this task.' });
    return res.status(200).json({ task: serializeTask(task, permissions) });
  } catch (error) {
    console.error('Get task error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving the task.' });
  }
};

export const updateTask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const parsed = TaskUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canManage) return res.status(403).json({ message: 'Only the task owner can change task details or status.' });

    const input = parsed.data;
    if (input.dueDate !== undefined && !validateFutureDueDate(input.dueDate)) {
      return res.status(400).json({ message: 'Target due date must be in the future.' });
    }
    if (input.workspaceId !== undefined && !await validateOwnedWorkspace(input.workspaceId, req.user.userId)) {
      return res.status(403).json({ message: 'You can only move a task to a workspace you own.' });
    }

    if (input.verifierId !== undefined && input.verifierId !== null) {
      const eligible = new Set(await getEligibleMonitorIds(req.user.userId));
      if (!eligible.has(input.verifierId)) {
        return res.status(400).json({ message: 'Selected verifier is not an active accountability partner.' });
      }
    }

    let sharedIds = getExplicitMonitorIds(task);
    if (input.sharedWithIds !== undefined) {
      const validated = await validateSharedMonitors(req.user.userId, input.sharedWithIds);
      if (!validated.valid) return res.status(400).json({ message: 'One or more selected users are not eligible accountability partners.' });
      sharedIds = validated.ids;
    }
    let visibility = input.visibility ?? task.visibility ?? (task.isPrivate ? TaskVisibility.PRIVATE : TaskVisibility.SELECTED_PARTNERS);
    if (input.isPrivate === true) visibility = TaskVisibility.PRIVATE;
    if (input.isPrivate === false && visibility === TaskVisibility.PRIVATE && sharedIds.length) visibility = TaskVisibility.SELECTED_PARTNERS;
    if (visibility === TaskVisibility.WORKSPACE && !(input.workspaceId ?? getIdString(task.workspaceId))) {
      return res.status(400).json({ message: 'Workspace visibility requires a workspace.' });
    }
    if (visibility === TaskVisibility.PRIVATE) sharedIds = [];

    const previousStatus = task.status;
    const isBecomingCompleted = input.status === TaskStatus.COMPLETED && previousStatus !== TaskStatus.COMPLETED;

    const immutableOwner = getTaskOwnerId(task);
    for (const field of ['title', 'description', 'status', 'priority', 'progressMode', 'manualProgress'] as const) {
      if (input[field] !== undefined) task[field] = input[field];
    }
    if (input.dueDate !== undefined) task.dueDate = input.dueDate;
    if (input.workspaceId !== undefined) task.workspaceId = input.workspaceId;
    if (input.recurrence !== undefined) task.recurrence = input.recurrence;
    if (input.verificationRequired !== undefined) task.verificationRequired = input.verificationRequired;
    if (input.verifierId !== undefined) task.verifierId = input.verifierId;

    task.ownerId = immutableOwner;
    task.visibility = visibility;
    task.isPrivate = visibility === TaskVisibility.PRIVATE;
    task.sharedWithIds = sharedIds;
    task.collaboratorIds = sharedIds;
    task.partnerId = sharedIds[0] || null;

    // Handle verification request trigger when completed
    if (isBecomingCompleted && task.verificationRequired && task.verifierId) {
      task.verificationStatus = VerificationStatus.PENDING;
      await createNotification({
        userId: task.verifierId,
        type: 'VERIFICATION_REQUEST',
        category: NotificationCategory.VERIFICATION,
        priority: NotificationPriority.HIGH,
        title: 'Task Completion Verification Needed',
        message: `The owner has completed "${task.title}" and requested your verification.`,
        taskId: task._id,
      });
    }

    await task.save();

    // If completed: award XP, spawn next recurrence if recurring, update streak & achievements
    if (isBecomingCompleted) {
      await awardXP(req.user.userId, XPReason.TASK_COMPLETED, task._id.toString());
      if (task.isRecurringInstance) {
        await awardXP(req.user.userId, XPReason.RECURRING_TASK_COMPLETED, `${task._id.toString()}_rec`);
      }
      if (task.recurrence && task.recurrence.frequency !== RecurrenceFrequency.NONE) {
        await generateNextOccurrence(task);
      }
      await evaluateAchievements(req.user.userId);
    }

    // Handle recurring series updates if editScope was specified
    if (task.recurringSeriesId && (input.editScope === 'FUTURE_INSTANCES' || input.editScope === 'ALL_INSTANCES')) {
      const seriesFilter: any = { recurringSeriesId: task.recurringSeriesId, _id: { $ne: task._id } };
      if (input.editScope === 'FUTURE_INSTANCES' && task.dueDate) {
        seriesFilter.dueDate = { $gt: task.dueDate };
      }
      const seriesUpdates: any = {};
      if (input.title) seriesUpdates.title = input.title;
      if (input.description !== undefined) seriesUpdates.description = input.description;
      if (input.priority) seriesUpdates.priority = input.priority;
      if (input.visibility) seriesUpdates.visibility = visibility;
      if (input.sharedWithIds) {
        seriesUpdates.sharedWithIds = sharedIds;
        seriesUpdates.collaboratorIds = sharedIds;
      }
      await Task.updateMany(seriesFilter, { $set: seriesUpdates });
    }

    if (input.status !== undefined) {
      await Promise.all(sharedIds.map((userId) => createNotification({
        userId,
        type: 'TASK_UPDATED',
        category: NotificationCategory.TASKS,
        title: 'Task status updated',
        message: `"${task.title}" moved to ${task.status.toLowerCase().replace('_', ' ')}.`,
        taskId: task._id,
      })));
    }

    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Task updated successfully', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ message: 'An error occurred while updating the task.' });
  }
};

export const deleteTask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can delete this task.' });
    }
    await Promise.all([
      task.deleteOne(),
      CheckIn.deleteMany({ taskId: task._id }),
      ProgressRequest.deleteMany({ taskId: task._id }),
    ]);
    return res.status(200).json({ message: 'Task deleted successfully.', id: req.params.id });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ message: 'An error occurred while deleting the task.' });
  }
};

// Subtask Management (Phase 3)
export const addSubtask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const parsed = SubtaskInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can add subtasks.' });
    }

    const order = parsed.data.order ?? task.subtasks.length;
    task.subtasks.push({
      title: parsed.data.title,
      description: parsed.data.description || '',
      dueDate: parsed.data.dueDate || null,
      completed: false,
      order,
    });

    await task.save();
    await task.populate(taskPopulate);
    return res.status(201).json({ message: 'Subtask added.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Add subtask error:', error);
    return res.status(500).json({ message: 'An error occurred while adding the subtask.' });
  }
};

export const updateSubtask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can edit subtasks.' });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ message: 'Subtask not found.' });

    const { title, description, dueDate, completed, order } = req.body;
    if (title !== undefined) subtask.title = String(title).trim();
    if (description !== undefined) subtask.description = String(description).trim();
    if (dueDate !== undefined) subtask.dueDate = dueDate ? new Date(dueDate) : null;
    if (order !== undefined) subtask.order = Number(order);
    if (completed !== undefined) {
      subtask.completed = Boolean(completed);
      subtask.completedAt = subtask.completed ? new Date() : null;
    }

    await task.save();
    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Subtask updated.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Update subtask error:', error);
    return res.status(500).json({ message: 'An error occurred while updating the subtask.' });
  }
};

export const deleteSubtask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can delete subtasks.' });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ message: 'Subtask not found.' });
    subtask.deleteOne();

    await task.save();
    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Subtask deleted.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Delete subtask error:', error);
    return res.status(500).json({ message: 'An error occurred while deleting the subtask.' });
  }
};

export const toggleSubtask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can toggle subtask completion.' });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ message: 'Subtask not found.' });

    subtask.completed = !subtask.completed;
    subtask.completedAt = subtask.completed ? new Date() : null;

    await task.save();
    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Subtask toggled.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Toggle subtask error:', error);
    return res.status(500).json({ message: 'An error occurred while toggling the subtask.' });
  }
};

// Milestone Management (Phase 3)
export const addMilestone = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const parsed = MilestoneInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can add milestones.' });
    }

    task.milestones.push({
      title: parsed.data.title,
      description: parsed.data.description || '',
      targetDate: parsed.data.targetDate || null,
      status: parsed.data.status,
      linkedSubtaskIds: parsed.data.linkedSubtaskIds || [],
      order: parsed.data.order ?? task.milestones.length,
    });

    await task.save();
    await task.populate(taskPopulate);
    return res.status(201).json({ message: 'Milestone added.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Add milestone error:', error);
    return res.status(500).json({ message: 'An error occurred while adding the milestone.' });
  }
};

export const updateMilestone = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can edit milestones.' });
    }

    const milestone = task.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found.' });

    const { title, description, targetDate, status, linkedSubtaskIds, order } = req.body;
    const wasCompleted = milestone.status === MilestoneStatus.COMPLETED;

    if (title !== undefined) milestone.title = String(title).trim();
    if (description !== undefined) milestone.description = String(description).trim();
    if (targetDate !== undefined) milestone.targetDate = targetDate ? new Date(targetDate) : null;
    if (linkedSubtaskIds !== undefined) milestone.linkedSubtaskIds = linkedSubtaskIds;
    if (order !== undefined) milestone.order = Number(order);
    if (status !== undefined) {
      milestone.status = status;
      milestone.completedAt = status === MilestoneStatus.COMPLETED ? new Date() : null;
    }

    await task.save();

    // If milestone reached: award XP and evaluate achievements
    if (status === MilestoneStatus.COMPLETED && !wasCompleted) {
      await awardXP(req.user.userId, XPReason.MILESTONE_COMPLETED, milestone._id.toString());
      await evaluateAchievements(req.user.userId);
    }

    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Milestone updated.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Update milestone error:', error);
    return res.status(500).json({ message: 'An error occurred while updating the milestone.' });
  }
};

export const deleteMilestone = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can delete milestones.' });
    }

    const milestone = task.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found.' });
    milestone.deleteOne();

    await task.save();
    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Milestone deleted.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Delete milestone error:', error);
    return res.status(500).json({ message: 'An error occurred while deleting the milestone.' });
  }
};

// Rescheduling & Overdue Recovery (Phase 9)
export const rescheduleTask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const schema = z.object({
    newDueDate: z.string().transform((v, ctx) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        ctx.addIssue({ code: 'custom', message: 'New deadline must be in the future.' });
        return z.NEVER;
      }
      return d;
    }),
    reason: z.string().max(500).trim().optional().default(''),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) {
      return res.status(403).json({ message: 'Only the task owner can reschedule deadlines.' });
    }

    task.rescheduleHistory.push({
      previousDueDate: task.dueDate || null,
      newDueDate: parsed.data.newDueDate,
      reason: parsed.data.reason,
      rescheduledBy: req.user.userId,
      rescheduledAt: new Date(),
    });

    task.dueDate = parsed.data.newDueDate;
    // If task was marked missed, restore to in-progress
    if (task.status === TaskStatus.MISSED) {
      task.status = TaskStatus.IN_PROGRESS;
    }

    await task.save();

    // Notify monitors
    const monitors = getExplicitMonitorIds(task);
    await Promise.all(monitors.map((userId) => createNotification({
      userId,
      type: 'TASK_RESCHEDULED',
      category: NotificationCategory.TASKS,
      title: 'Task Rescheduled',
      message: `"${task.title}" has been rescheduled to ${new Date(task.dueDate).toLocaleDateString()}. Reason: ${parsed.data.reason || 'None provided'}`,
      taskId: task._id,
    })));

    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Task rescheduled successfully.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Reschedule task error:', error);
    return res.status(500).json({ message: 'An error occurred while rescheduling the task.' });
  }
};

// Completion Verification (Phase 6)
export const verifyTaskCompletion = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  const schema = z.object({
    decision: z.enum(['VERIFY', 'REQUEST_CLARIFICATION']),
    notes: z.string().max(1000).trim().optional().default(''),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Only the designated verifier or an authorized monitor can verify
    const permissions = await getTaskPermissions(task, req.user.userId);
    const isDesignated = getIdString(task.verifierId) === req.user.userId;
    const isAuthorizedMonitor = permissions.role === 'MONITOR';

    if (!isDesignated && !isAuthorizedMonitor) {
      return res.status(403).json({ message: 'You are not authorized to verify this task.' });
    }

    if (parsed.data.decision === 'VERIFY') {
      task.verificationStatus = VerificationStatus.VERIFIED;
      task.verifiedAt = new Date();
      task.verificationNotes = parsed.data.notes;

      await createNotification({
        userId: task.ownerId,
        type: 'VERIFICATION_APPROVED',
        category: NotificationCategory.VERIFICATION,
        priority: NotificationPriority.HIGH,
        title: 'Task Completion Verified!',
        message: `Your partner verified "${task.title}". Great job!`,
        taskId: task._id,
      });
    } else {
      task.verificationStatus = VerificationStatus.NEEDS_CLARIFICATION;
      task.clarificationRequestedAt = new Date();
      task.verificationNotes = parsed.data.notes;

      await createNotification({
        userId: task.ownerId,
        type: 'VERIFICATION_CLARIFICATION',
        category: NotificationCategory.VERIFICATION,
        priority: NotificationPriority.HIGH,
        title: 'Verification: Clarification Requested',
        message: `Your partner reviewed "${task.title}" and requested clarification: "${parsed.data.notes}"`,
        taskId: task._id,
      });
    }

    await task.save();
    await task.populate(taskPopulate);
    return res.status(200).json({ message: 'Verification recorded.', task: serializeTask(task, await getTaskPermissions(task, req.user.userId)) });
  } catch (error) {
    console.error('Verify task error:', error);
    return res.status(500).json({ message: 'An error occurred during verification.' });
  }
};

// Progress Timeline (Phase 5)
export const getTaskTimeline = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task = await Task.findById(req.params.id).populate(taskPopulate);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const permissions = await getTaskPermissions(task, req.user.userId);
    if (!permissions.canView) return res.status(403).json({ message: 'You do not have permission to view this task timeline.' });

    // Fetch check-ins
    const checkIns = await CheckIn.find({ taskId: task._id }).populate('userId', 'username name image').sort({ createdAt: 1 });

    const events: any[] = [];

    // 1. Task Created
    events.push({
      type: 'TASK_CREATED',
      title: 'Task Created',
      description: task.title,
      actor: task.ownerId,
      timestamp: task.createdAt,
    });

    // 2. Rescheduling events
    (task.rescheduleHistory || []).forEach((r: any) => {
      events.push({
        type: 'TASK_RESCHEDULED',
        title: 'Deadline Rescheduled',
        description: `New deadline: ${new Date(r.newDueDate).toLocaleDateString()}${r.reason ? ` — ${r.reason}` : ''}`,
        actor: task.ownerId,
        timestamp: r.rescheduledAt,
      });
    });

    // 3. Milestones completed
    (task.milestones || []).forEach((m: any) => {
      if (m.completedAt) {
        events.push({
          type: 'MILESTONE_COMPLETED',
          title: `Milestone reached: ${m.title}`,
          description: m.description,
          actor: task.ownerId,
          timestamp: m.completedAt,
        });
      }
    });

    // 4. Check-ins
    checkIns.forEach((c: any) => {
      // Filter out private partner feedback unless viewer is author or task owner
      if (c.isPrivate && c.userId._id.toString() !== req.user.userId && !permissions.isOwner) {
        return;
      }
      events.push({
        type: c.kind === CheckInKind.OWNER_PROGRESS ? 'PROGRESS_UPDATE' : 'PARTNER_FEEDBACK',
        title: c.kind === CheckInKind.OWNER_PROGRESS ? `Progress update (${c.progress ?? 0}%)` : 'Partner Feedback',
        description: c.notes || c.completedWork || '',
        actor: c.userId,
        timestamp: c.createdAt,
        evidence: c.evidence,
        progress: c.progress,
        status: c.status,
      });
    });

    // 5. Verification events
    if (task.verifiedAt) {
      events.push({
        type: 'VERIFICATION_COMPLETED',
        title: 'Task Verified',
        description: task.verificationNotes || 'Completion verified by partner.',
        actor: task.verifierId,
        timestamp: task.verifiedAt,
      });
    }

    // Sort all events chronologically descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({ timeline: events });
  } catch (error) {
    console.error('Get timeline error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving the timeline.' });
  }
};

// Dashboard Endpoint (Phase 1)
export const getDashboardData = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const userId = req.user.userId;
    const candidates = await Task.find(taskCandidateQuery(userId)).populate(taskPopulate).sort({ createdAt: -1 });
    const permissionList = await Promise.all(candidates.map((task) => getTaskPermissions(task, userId)));
    const visible = candidates.flatMap((task, index) => permissionList[index].canView ? [{ task, permissions: permissionList[index] }] : []);

    const owned = visible.filter(({ permissions }) => permissions.isOwner).map(({ task }) => task);
    const monitored = visible.filter(({ permissions }) => permissions.role === 'MONITOR').map(({ task }) => task);
    const ownedShared = owned.filter((task) => getExplicitMonitorIds(task).length > 0);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const dueToday = owned.filter((task) => {
      if (task.status === TaskStatus.COMPLETED || !task.dueDate) return false;
      const d = new Date(task.dueDate);
      return d >= todayStart && d <= todayEnd;
    });

    const overdue = owned.filter((task) => task.status !== TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) < now);
    const upcoming = owned.filter((task) => task.status !== TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 10);

    const serialized = visible.map(({ task, permissions }) => serializeTask(task, permissions));
    const myTasks = serialized.filter((task: any) => task.permissions.isOwner);
    const monitoringTasks = serialized.filter((task: any) => task.permissions.role === 'MONITOR');

    // Actionable items: pending invites, progress requests, verification requests
    const [pendingInvites, pendingProgressRequests, pendingVerificationsForMe, userProfile] = await Promise.all([
      Invite.find({ receiverId: userId, status: InviteStatus.PENDING, expiresAt: { $gt: now } }).populate('senderId', 'username name image').populate('taskId', 'title'),
      ProgressRequest.find({ ownerId: userId, status: ProgressRequestStatus.PENDING }).populate('requesterId', 'username name image').populate('taskId', 'title'),
      Task.find({ verifierId: userId, verificationStatus: VerificationStatus.PENDING, status: TaskStatus.COMPLETED }).populate(taskPopulate),
      User.findById(userId).select('xp level currentStreak longestStreak achievements preferences onboardingCompleted onboardingStep'),
    ]);

    const needsAttention = [
      ...pendingInvites.map((inv: any) => ({
        id: `invite_${inv._id}`,
        type: 'INVITE',
        title: 'Partnership or Task Invite',
        message: `${inv.senderId?.name || inv.senderId?.username} sent you an invitation${inv.taskId ? ` for "${inv.taskId.title}"` : ''}.`,
        link: '/dashboard',
        actionType: 'ACCEPT_DECLINE',
        inviteId: inv._id,
        createdAt: inv.createdAt,
      })),
      ...pendingProgressRequests.map((reqItem: any) => ({
        id: `prog_req_${reqItem._id}`,
        type: 'PROGRESS_REQUEST',
        title: 'Progress Update Requested',
        message: `${reqItem.requesterId?.name || reqItem.requesterId?.username} requested an update on "${reqItem.taskId?.title}".`,
        link: `/tasks/${reqItem.taskId?._id}`,
        taskId: reqItem.taskId?._id,
        requestId: reqItem._id,
        createdAt: reqItem.requestedAt,
      })),
      ...pendingVerificationsForMe.map((verTask: any) => ({
        id: `verify_${verTask._id}`,
        type: 'VERIFICATION_REQUEST',
        title: 'Completion Verification Needed',
        message: `Verify completion of "${verTask.title}" for ${verTask.ownerId?.name || verTask.ownerId?.username}.`,
        link: `/tasks/${verTask._id}`,
        taskId: verTask._id,
        createdAt: verTask.updatedAt,
      })),
      ...overdue.slice(0, 5).map((t: any) => ({
        id: `overdue_${t._id}`,
        type: 'OVERDUE_TASK',
        title: 'Overdue Commitment',
        message: `"${t.title}" missed its target deadline. Reschedule or post a progress update.`,
        link: `/tasks/${t._id}`,
        taskId: t._id,
        createdAt: t.dueDate,
      })),
    ];

    // Recent meaningful activities
    const ownedTaskIds = owned.map((t) => t._id);
    const monitoredTaskIds = monitored.map((t) => t._id);
    const allTaskIds = [...ownedTaskIds, ...monitoredTaskIds];

    const recentCheckIns = await CheckIn.find({ taskId: { $in: allTaskIds } })
      .populate('userId', 'username name image')
      .populate('taskId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    const activities = recentCheckIns.map((ci: any) => ({
      id: ci._id,
      type: ci.kind === CheckInKind.OWNER_PROGRESS ? 'CHECK_IN' : 'FEEDBACK',
      message: ci.kind === CheckInKind.OWNER_PROGRESS
        ? `${ci.userId?.name || ci.userId?.username} posted an update on "${ci.taskId?.title}": ${ci.notes || ci.completedWork || 'Progress logged'}`
        : `${ci.userId?.name || ci.userId?.username} gave feedback on "${ci.taskId?.title}"`,
      actor: ci.userId,
      taskId: ci.taskId?._id,
      taskTitle: ci.taskId?.title,
      timestamp: ci.createdAt,
    }));

    return res.status(200).json({
      stats: {
        totalTasks: owned.length,
        completedTasks: owned.filter((task) => task.status === TaskStatus.COMPLETED).length,
        inProgressTasks: owned.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
        pendingTasks: owned.filter((task) => task.status === TaskStatus.PENDING).length,
        dueTodayTasks: dueToday.length,
        overdueTasks: overdue.length,
        sharedTasks: ownedShared.length,
        monitoringTasks: monitored.length,
        xp: userProfile?.xp || 0,
        level: userProfile?.level || 1,
        currentStreak: userProfile?.currentStreak || 0,
        longestStreak: userProfile?.longestStreak || 0,
      },
      userGamification: {
        xp: userProfile?.xp || 0,
        level: userProfile?.level || 1,
        currentStreak: userProfile?.currentStreak || 0,
        longestStreak: userProfile?.longestStreak || 0,
        achievements: userProfile?.achievements || [],
        onboardingCompleted: userProfile?.onboardingCompleted || false,
      },
      allTasks: serialized,
      myTasks,
      monitoringTasks,
      dueTodayTasks: dueToday.map((task) => serialized.find((i) => i.id === task.id)),
      overdueTasks: overdue.map((task) => serialized.find((i) => i.id === task.id)),
      upcomingDeadlines: upcoming.map((task) => serialized.find((i) => i.id === task.id)),
      needsAttention,
      activities,
      checkInReminders: monitored.slice(0, 3).map((task) => ({
        taskId: task.id,
        taskTitle: task.title,
        partnerName: (task.creatorId as any)?.name || `@${(task.creatorId as any)?.username || 'owner'}`,
        message: `Review ${task.title}`,
      })),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ message: 'An error occurred while retrieving dashboard data.' });
  }
};

export const removeCollaboratorFromTask = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const task: any = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const permissions = await getTaskPermissions(task, req.user.userId);
    const isSelf = req.params.partnerId === req.user.userId && permissions.role === 'MONITOR';
    if (!permissions.canManage && !isSelf) return res.status(403).json({ message: 'You cannot revoke this task access.' });
    const remaining = getExplicitMonitorIds(task).filter((id) => id !== req.params.partnerId);
    task.sharedWithIds = remaining;
    task.collaboratorIds = remaining;
    task.partnerId = remaining[0] || null;
    if (!remaining.length && task.visibility === TaskVisibility.SELECTED_PARTNERS) {
      task.visibility = TaskVisibility.PRIVATE;
      task.isPrivate = true;
    }
    await task.save();
    return res.status(200).json({ message: isSelf ? 'You stopped monitoring this task.' : 'Partner access revoked.' });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    return res.status(500).json({ message: 'An error occurred while revoking task access.' });
  }
};
