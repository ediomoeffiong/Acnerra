import { Response } from 'express';
import { z } from 'zod';
import { Task, TaskPriority, TaskStatus, TaskVisibility } from '../models/Task';
import { CheckIn } from '../models/CheckIn';
import { Workspace } from '../models/Workspace';
import { createNotification } from '../lib/notifications';
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

const TaskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100).trim(),
  description: z.string().max(1000).trim().optional().default(''),
  status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.PENDING),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
  dueDate: dueDateField,
  workspaceId: objectIdString.nullable().optional(),
  visibility: z.nativeEnum(TaskVisibility).optional().default(TaskVisibility.PRIVATE),
  sharedWithIds: z.array(objectIdString).max(100).optional().default([]),
  // Accepted for old clients, but never used to infer broad sharing.
  isPrivate: z.boolean().optional(),
  partnerId: z.null().optional(),
  collaboratorIds: z.array(objectIdString).max(100).optional(),
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
}).strict();

const taskPopulate = [
  { path: 'ownerId', select: 'username name image' },
  { path: 'creatorId', select: 'username name image' },
  { path: 'partnerId', select: 'username name image' },
  { path: 'collaboratorIds', select: 'username name image' },
  { path: 'sharedWithIds', select: 'username name image' },
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

    let visibility = input.visibility;
    if (input.isPrivate === true || shared.ids.length === 0 && visibility === TaskVisibility.SELECTED_PARTNERS) {
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
    });

    await Promise.all(effectiveShares.map((userId) => createNotification({
      userId,
      type: 'TASK_UPDATED',
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
    if (req.query.workspaceId !== undefined) query.workspaceId = ['null', 'none'].includes(req.query.workspaceId) ? null : req.query.workspaceId;
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
    if (!validateFutureDueDate(input.dueDate)) return res.status(400).json({ message: 'Target due date must be in the future.' });
    if (input.workspaceId !== undefined && !await validateOwnedWorkspace(input.workspaceId, req.user.userId)) {
      return res.status(403).json({ message: 'You can only move a task to a workspace you own.' });
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

    const immutableOwner = getTaskOwnerId(task);
    for (const field of ['title', 'description', 'status', 'priority'] as const) {
      if (input[field] !== undefined) task[field] = input[field];
    }
    if (input.dueDate !== undefined) task.dueDate = input.dueDate;
    if (input.workspaceId !== undefined) task.workspaceId = input.workspaceId;
    task.ownerId = immutableOwner;
    task.visibility = visibility;
    task.isPrivate = visibility === TaskVisibility.PRIVATE;
    task.sharedWithIds = sharedIds;
    task.collaboratorIds = sharedIds;
    task.partnerId = sharedIds[0] || null;
    await task.save();

    if (input.status !== undefined) {
      await Promise.all(sharedIds.map((userId) => createNotification({
        userId, type: 'TASK_UPDATED', title: 'Task status updated',
        message: `"${task.title}" moved to ${task.status.toLowerCase().replace('_', ' ')}.`, taskId: task._id,
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
    if (!(await getTaskPermissions(task, req.user.userId)).canManage) return res.status(403).json({ message: 'Only the task owner can delete this task.' });
    await Promise.all([task.deleteOne(), CheckIn.deleteMany({ taskId: task._id })]);
    return res.status(200).json({ message: 'Task deleted successfully.', id: req.params.id });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ message: 'An error occurred while deleting the task.' });
  }
};

export const getDashboardData = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const candidates = await Task.find(taskCandidateQuery(req.user.userId)).populate(taskPopulate).sort({ createdAt: -1 });
    const permissionList = await Promise.all(candidates.map((task) => getTaskPermissions(task, req.user.userId)));
    const visible = candidates.flatMap((task, index) => permissionList[index].canView ? [{ task, permissions: permissionList[index] }] : []);
    const owned = visible.filter(({ permissions }) => permissions.isOwner).map(({ task }) => task);
    const monitored = visible.filter(({ permissions }) => permissions.role === 'MONITOR').map(({ task }) => task);
    const ownedShared = owned.filter((task) => getExplicitMonitorIds(task).length > 0);
    const now = new Date();
    const overdue = owned.filter((task) => task.status !== TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) < now);
    const upcoming = owned.filter((task) => task.status !== TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 5);
    const serialized = visible.map(({ task, permissions }) => serializeTask(task, permissions));
    return res.status(200).json({
      stats: {
        totalTasks: owned.length,
        completedTasks: owned.filter((task) => task.status === TaskStatus.COMPLETED).length,
        inProgressTasks: owned.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
        pendingTasks: owned.filter((task) => task.status === TaskStatus.PENDING).length,
        overdueTasks: overdue.length,
        sharedTasks: ownedShared.length,
      },
      allTasks: serialized,
      myTasks: serialized.filter((task: any) => task.permissions.isOwner),
      monitoringTasks: serialized.filter((task: any) => task.permissions.role === 'MONITOR'),
      overdueTasks: overdue.map((task) => serializeTask(task, { isOwner: true, canView: true, canComment: true, canManage: true, role: 'OWNER' })),
      upcomingDeadlines: upcoming.map((task) => serializeTask(task, { isOwner: true, canView: true, canComment: true, canManage: true, role: 'OWNER' })),
      sharedTasks: [...ownedShared, ...monitored].map((task) => serialized.find((item: any) => item.id === task.id)),
      activities: [],
      checkInReminders: monitored.slice(0, 3).map((task) => ({ taskId: task.id, taskTitle: task.title, partnerName: (task.creatorId as any)?.name || `@${(task.creatorId as any)?.username || 'owner'}`, message: `Review ${task.title}` })),
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
