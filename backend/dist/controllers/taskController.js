"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeCollaboratorFromTask = exports.getDashboardData = exports.deleteTask = exports.updateTask = exports.getTaskById = exports.getTasks = exports.createTask = void 0;
const zod_1 = require("zod");
const Task_1 = require("../models/Task");
const CheckIn_1 = require("../models/CheckIn");
const Workspace_1 = require("../models/Workspace");
const notifications_1 = require("../lib/notifications");
const taskAccess_1 = require("../lib/taskAccess");
const objectIdString = zod_1.z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');
const dueDateField = zod_1.z.string().nullable().optional().transform((value, ctx) => {
    if (value === undefined || value === null || value === '')
        return value === undefined ? undefined : null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: 'custom', message: 'Invalid due date' });
        return zod_1.z.NEVER;
    }
    return parsed;
});
const TaskCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(100).trim(),
    description: zod_1.z.string().max(1000).trim().optional().default(''),
    status: zod_1.z.nativeEnum(Task_1.TaskStatus).optional().default(Task_1.TaskStatus.PENDING),
    priority: zod_1.z.nativeEnum(Task_1.TaskPriority).optional().default(Task_1.TaskPriority.MEDIUM),
    dueDate: dueDateField,
    workspaceId: objectIdString.nullable().optional(),
    visibility: zod_1.z.nativeEnum(Task_1.TaskVisibility).optional().default(Task_1.TaskVisibility.PRIVATE),
    sharedWithIds: zod_1.z.array(objectIdString).max(100).optional().default([]),
    // Accepted for old clients, but never used to infer broad sharing.
    isPrivate: zod_1.z.boolean().optional(),
    partnerId: zod_1.z.null().optional(),
    collaboratorIds: zod_1.z.array(objectIdString).max(100).optional(),
}).strict();
const TaskUpdateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(100).trim().optional(),
    description: zod_1.z.string().max(1000).trim().optional(),
    status: zod_1.z.nativeEnum(Task_1.TaskStatus).optional(),
    priority: zod_1.z.nativeEnum(Task_1.TaskPriority).optional(),
    dueDate: dueDateField,
    workspaceId: objectIdString.nullable().optional(),
    visibility: zod_1.z.nativeEnum(Task_1.TaskVisibility).optional(),
    sharedWithIds: zod_1.z.array(objectIdString).max(100).optional(),
    isPrivate: zod_1.z.boolean().optional(),
    partnerId: zod_1.z.null().optional(),
}).strict();
const taskPopulate = [
    { path: 'ownerId', select: 'username name image' },
    { path: 'creatorId', select: 'username name image' },
    { path: 'partnerId', select: 'username name image' },
    { path: 'collaboratorIds', select: 'username name image' },
    { path: 'sharedWithIds', select: 'username name image' },
];
const taskCandidateQuery = (userId) => ({
    $or: [
        { ownerId: userId },
        { ownerId: null, creatorId: userId },
        { sharedWithIds: userId },
        { partnerId: userId },
        { collaboratorIds: userId },
        { visibility: Task_1.TaskVisibility.WORKSPACE },
    ],
});
const validateFutureDueDate = (date) => !date || date.getTime() > Date.now();
const validateOwnedWorkspace = async (workspaceId, ownerId) => {
    if (!workspaceId)
        return true;
    return Boolean(await Workspace_1.Workspace.exists({ _id: workspaceId, userId: ownerId }));
};
const validateSharedMonitors = async (ownerId, requested) => {
    const unique = Array.from(new Set(requested)).filter((id) => id !== ownerId);
    const eligible = new Set(await (0, taskAccess_1.getEligibleMonitorIds)(ownerId));
    return { valid: unique.every((id) => eligible.has(id)), ids: unique };
};
const serializeTask = (task, permissions) => ({
    ...task.toJSON(),
    permissions,
    role: permissions.role,
});
const createTask = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    const parsed = TaskCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    try {
        const ownerId = req.user.userId;
        const input = parsed.data;
        if (!validateFutureDueDate(input.dueDate))
            return res.status(400).json({ message: 'Target due date must be in the future.' });
        if (!await validateOwnedWorkspace(input.workspaceId, ownerId)) {
            return res.status(403).json({ message: 'You can only place a task in a workspace you own.' });
        }
        const requestedIds = input.sharedWithIds.length ? input.sharedWithIds : (input.collaboratorIds || []);
        const shared = await validateSharedMonitors(ownerId, requestedIds);
        if (!shared.valid)
            return res.status(400).json({ message: 'One or more selected users are not eligible accountability partners.' });
        let visibility = input.visibility;
        if (input.isPrivate === true || shared.ids.length === 0 && visibility === Task_1.TaskVisibility.SELECTED_PARTNERS) {
            visibility = Task_1.TaskVisibility.PRIVATE;
        }
        if (shared.ids.length > 0 && visibility === Task_1.TaskVisibility.PRIVATE && input.isPrivate !== true) {
            visibility = Task_1.TaskVisibility.SELECTED_PARTNERS;
        }
        if (visibility === Task_1.TaskVisibility.WORKSPACE && !input.workspaceId) {
            return res.status(400).json({ message: 'Workspace visibility requires a workspace.' });
        }
        const duplicate = input.status !== Task_1.TaskStatus.COMPLETED && await Task_1.Task.findOne({
            $or: [{ ownerId }, { ownerId: null, creatorId: ownerId }],
            status: { $ne: Task_1.TaskStatus.COMPLETED },
            title: { $regex: new RegExp(`^${input.title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
        });
        if (duplicate)
            return res.status(409).json({ message: 'An active task with this title already exists.' });
        const effectiveShares = visibility === Task_1.TaskVisibility.PRIVATE ? [] : shared.ids;
        const task = await Task_1.Task.create({
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            dueDate: input.dueDate || null,
            ownerId,
            creatorId: ownerId,
            visibility,
            isPrivate: visibility === Task_1.TaskVisibility.PRIVATE,
            sharedWithIds: effectiveShares,
            collaboratorIds: effectiveShares,
            partnerId: effectiveShares[0] || null,
            workspaceId: input.workspaceId || null,
        });
        await Promise.all(effectiveShares.map((userId) => (0, notifications_1.createNotification)({
            userId,
            type: 'TASK_UPDATED',
            title: 'Task shared with you',
            message: `You can now monitor "${task.title}". The owner remains responsible for completing it.`,
            taskId: task._id,
        })));
        await task.populate(taskPopulate);
        return res.status(201).json({ message: 'Task created successfully', task: serializeTask(task, await (0, taskAccess_1.getTaskPermissions)(task, ownerId)) });
    }
    catch (error) {
        console.error('Create task error:', error);
        return res.status(500).json({ message: 'An error occurred while creating the task.' });
    }
};
exports.createTask = createTask;
const getTasks = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const query = taskCandidateQuery(req.user.userId);
        if (req.query.workspaceId !== undefined)
            query.workspaceId = ['null', 'none'].includes(req.query.workspaceId) ? null : req.query.workspaceId;
        const candidates = await Task_1.Task.find(query).populate(taskPopulate).sort({ createdAt: -1 });
        const permissions = await Promise.all(candidates.map((task) => (0, taskAccess_1.getTaskPermissions)(task, req.user.userId)));
        const tasks = candidates.flatMap((task, index) => permissions[index].canView ? [serializeTask(task, permissions[index])] : []);
        return res.status(200).json({ tasks });
    }
    catch (error) {
        console.error('Get tasks error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving tasks.' });
    }
};
exports.getTasks = getTasks;
const getTaskById = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const task = await Task_1.Task.findById(req.params.id).populate(taskPopulate);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        const permissions = await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId);
        if (!permissions.canView)
            return res.status(403).json({ message: 'You do not have permission to view this task.' });
        return res.status(200).json({ task: serializeTask(task, permissions) });
    }
    catch (error) {
        console.error('Get task error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving the task.' });
    }
};
exports.getTaskById = getTaskById;
const updateTask = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    const parsed = TaskUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    try {
        const task = await Task_1.Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        const permissions = await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId);
        if (!permissions.canManage)
            return res.status(403).json({ message: 'Only the task owner can change task details or status.' });
        const input = parsed.data;
        if (!validateFutureDueDate(input.dueDate))
            return res.status(400).json({ message: 'Target due date must be in the future.' });
        if (input.workspaceId !== undefined && !await validateOwnedWorkspace(input.workspaceId, req.user.userId)) {
            return res.status(403).json({ message: 'You can only move a task to a workspace you own.' });
        }
        let sharedIds = (0, taskAccess_1.getExplicitMonitorIds)(task);
        if (input.sharedWithIds !== undefined) {
            const validated = await validateSharedMonitors(req.user.userId, input.sharedWithIds);
            if (!validated.valid)
                return res.status(400).json({ message: 'One or more selected users are not eligible accountability partners.' });
            sharedIds = validated.ids;
        }
        let visibility = input.visibility ?? task.visibility ?? (task.isPrivate ? Task_1.TaskVisibility.PRIVATE : Task_1.TaskVisibility.SELECTED_PARTNERS);
        if (input.isPrivate === true)
            visibility = Task_1.TaskVisibility.PRIVATE;
        if (input.isPrivate === false && visibility === Task_1.TaskVisibility.PRIVATE && sharedIds.length)
            visibility = Task_1.TaskVisibility.SELECTED_PARTNERS;
        if (visibility === Task_1.TaskVisibility.WORKSPACE && !(input.workspaceId ?? (0, taskAccess_1.getIdString)(task.workspaceId))) {
            return res.status(400).json({ message: 'Workspace visibility requires a workspace.' });
        }
        if (visibility === Task_1.TaskVisibility.PRIVATE)
            sharedIds = [];
        const immutableOwner = (0, taskAccess_1.getTaskOwnerId)(task);
        for (const field of ['title', 'description', 'status', 'priority']) {
            if (input[field] !== undefined)
                task[field] = input[field];
        }
        if (input.dueDate !== undefined)
            task.dueDate = input.dueDate;
        if (input.workspaceId !== undefined)
            task.workspaceId = input.workspaceId;
        task.ownerId = immutableOwner;
        task.visibility = visibility;
        task.isPrivate = visibility === Task_1.TaskVisibility.PRIVATE;
        task.sharedWithIds = sharedIds;
        task.collaboratorIds = sharedIds;
        task.partnerId = sharedIds[0] || null;
        await task.save();
        if (input.status !== undefined) {
            await Promise.all(sharedIds.map((userId) => (0, notifications_1.createNotification)({
                userId, type: 'TASK_UPDATED', title: 'Task status updated',
                message: `"${task.title}" moved to ${task.status.toLowerCase().replace('_', ' ')}.`, taskId: task._id,
            })));
        }
        await task.populate(taskPopulate);
        return res.status(200).json({ message: 'Task updated successfully', task: serializeTask(task, await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId)) });
    }
    catch (error) {
        console.error('Update task error:', error);
        return res.status(500).json({ message: 'An error occurred while updating the task.' });
    }
};
exports.updateTask = updateTask;
const deleteTask = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const task = await Task_1.Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        if (!(await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId)).canManage)
            return res.status(403).json({ message: 'Only the task owner can delete this task.' });
        await Promise.all([task.deleteOne(), CheckIn_1.CheckIn.deleteMany({ taskId: task._id })]);
        return res.status(200).json({ message: 'Task deleted successfully.', id: req.params.id });
    }
    catch (error) {
        console.error('Delete task error:', error);
        return res.status(500).json({ message: 'An error occurred while deleting the task.' });
    }
};
exports.deleteTask = deleteTask;
const getDashboardData = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const candidates = await Task_1.Task.find(taskCandidateQuery(req.user.userId)).populate(taskPopulate).sort({ createdAt: -1 });
        const permissionList = await Promise.all(candidates.map((task) => (0, taskAccess_1.getTaskPermissions)(task, req.user.userId)));
        const visible = candidates.flatMap((task, index) => permissionList[index].canView ? [{ task, permissions: permissionList[index] }] : []);
        const owned = visible.filter(({ permissions }) => permissions.isOwner).map(({ task }) => task);
        const monitored = visible.filter(({ permissions }) => permissions.role === 'MONITOR').map(({ task }) => task);
        const ownedShared = owned.filter((task) => (0, taskAccess_1.getExplicitMonitorIds)(task).length > 0);
        const now = new Date();
        const overdue = owned.filter((task) => task.status !== Task_1.TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) < now);
        const upcoming = owned.filter((task) => task.status !== Task_1.TaskStatus.COMPLETED && task.dueDate && new Date(task.dueDate) >= now)
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 5);
        const serialized = visible.map(({ task, permissions }) => serializeTask(task, permissions));
        return res.status(200).json({
            stats: {
                totalTasks: owned.length,
                completedTasks: owned.filter((task) => task.status === Task_1.TaskStatus.COMPLETED).length,
                inProgressTasks: owned.filter((task) => task.status === Task_1.TaskStatus.IN_PROGRESS).length,
                pendingTasks: owned.filter((task) => task.status === Task_1.TaskStatus.PENDING).length,
                overdueTasks: overdue.length,
                sharedTasks: ownedShared.length,
            },
            allTasks: serialized,
            myTasks: serialized.filter((task) => task.permissions.isOwner),
            monitoringTasks: serialized.filter((task) => task.permissions.role === 'MONITOR'),
            overdueTasks: overdue.map((task) => serializeTask(task, { isOwner: true, canView: true, canComment: true, canManage: true, role: 'OWNER' })),
            upcomingDeadlines: upcoming.map((task) => serializeTask(task, { isOwner: true, canView: true, canComment: true, canManage: true, role: 'OWNER' })),
            sharedTasks: [...ownedShared, ...monitored].map((task) => serialized.find((item) => item.id === task.id)),
            activities: [],
            checkInReminders: monitored.slice(0, 3).map((task) => ({ taskId: task.id, taskTitle: task.title, partnerName: task.creatorId?.name || `@${task.creatorId?.username || 'owner'}`, message: `Review ${task.title}` })),
        });
    }
    catch (error) {
        console.error('Dashboard error:', error);
        return res.status(500).json({ message: 'An error occurred while retrieving dashboard data.' });
    }
};
exports.getDashboardData = getDashboardData;
const removeCollaboratorFromTask = async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' });
    try {
        const task = await Task_1.Task.findById(req.params.id);
        if (!task)
            return res.status(404).json({ message: 'Task not found.' });
        const permissions = await (0, taskAccess_1.getTaskPermissions)(task, req.user.userId);
        const isSelf = req.params.partnerId === req.user.userId && permissions.role === 'MONITOR';
        if (!permissions.canManage && !isSelf)
            return res.status(403).json({ message: 'You cannot revoke this task access.' });
        const remaining = (0, taskAccess_1.getExplicitMonitorIds)(task).filter((id) => id !== req.params.partnerId);
        task.sharedWithIds = remaining;
        task.collaboratorIds = remaining;
        task.partnerId = remaining[0] || null;
        if (!remaining.length && task.visibility === Task_1.TaskVisibility.SELECTED_PARTNERS) {
            task.visibility = Task_1.TaskVisibility.PRIVATE;
            task.isPrivate = true;
        }
        await task.save();
        return res.status(200).json({ message: isSelf ? 'You stopped monitoring this task.' : 'Partner access revoked.' });
    }
    catch (error) {
        console.error('Remove collaborator error:', error);
        return res.status(500).json({ message: 'An error occurred while revoking task access.' });
    }
};
exports.removeCollaboratorFromTask = removeCollaboratorFromTask;
