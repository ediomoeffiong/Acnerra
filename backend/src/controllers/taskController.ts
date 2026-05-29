import { Request, Response } from 'express';
import { z } from 'zod';
import { Task, TaskStatus, TaskPriority } from '../models/Task';
import { CheckIn } from '../models/CheckIn';
import { User } from '../models/User';
import { createNotification } from '../lib/notifications';
import { canAccessTask, getIdString, getTaskParticipantIds, isTaskCreator } from '../lib/taskAccess';

// Zod schemas for validation
const TaskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long").trim(),
  description: z.string().max(1000, "Description is too long").trim().optional().default(''),
  status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.PENDING),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
  dueDate: z.string().nullable().optional().transform(val => {
    if (!val) return null;
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  }),
  partnerId: z.string().nullable().optional(),
  isPrivate: z.boolean().optional().default(false),
  workspaceId: z.string().nullable().optional(),
});

const TaskUpdateSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(100, "Title is too long").trim().optional(),
  description: z.string().max(1000, "Description is too long").trim().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().nullable().optional().transform(val => {
    if (val === undefined) return undefined;
    if (!val) return null;
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  }),
  partnerId: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  workspaceId: z.string().nullable().optional(),
});

// Helper for ownership validation (both creator and partner have access)
const checkOwnership = (task: any, req: any): boolean => {
  if (!task || !req.user) return false;
  return canAccessTask(task, req.user.userId);
};

// Helper for strict creator validation (only the owner can delete)
const checkCreator = (task: any, req: any): boolean => {
  if (!task || !req.user) return false;
  return isTaskCreator(task, req.user.userId);
};

// Create a new task
export const createTask = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const validatedFields = TaskCreateSchema.safeParse(req.body);

  if (!validatedFields.success) {
    return res.status(400).json({
      errors: validatedFields.error.flatten().fieldErrors,
    });
  }

  const { title, description, status, priority, dueDate, partnerId, isPrivate, workspaceId } = validatedFields.data;
  const creatorId = req.user.userId;

  try {
    if (dueDate && new Date(dueDate) <= new Date()) {
      return res.status(400).json({
        message: "Target due date must be in the future.",
      });
    }

    if (partnerId) {
      return res.status(400).json({
        message: "Create the task first, then invite collaborators by username.",
      });
    }

    let partnerIdToSet = null;
    let collaboratorIdsToSet: any[] = [];

    const user = await User.findById(creatorId).select('username accountabilityPartners');

    if (!isPrivate && user && user.accountabilityPartners && user.accountabilityPartners.length > 0) {
      partnerIdToSet = user.accountabilityPartners[0];
      collaboratorIdsToSet = user.accountabilityPartners;
    }

    const task = new Task({
      title,
      description,
      status,
      priority,
      dueDate,
      creatorId,
      partnerId: partnerIdToSet,
      collaboratorIds: collaboratorIdsToSet,
      isPrivate: !!isPrivate,
      workspaceId: workspaceId || null,
    });

    await task.save();

    // Send notifications to auto-added partners
    if (!isPrivate && user && user.accountabilityPartners && user.accountabilityPartners.length > 0) {
      await Promise.all(user.accountabilityPartners.map((pId: any) =>
        createNotification({
          userId: pId,
          type: 'INVITE_ACCEPTED',
          title: 'Accountability task link',
          message: `@${user.username} automatically added you to their task "${title}".`,
          taskId: task._id,
        })
      ));
    }
    
    // Populate before returning
    await task.populate([
      { path: 'creatorId', select: 'username name image' },
      { path: 'partnerId', select: 'username name image' },
      { path: 'collaboratorIds', select: 'username name image' }
    ]);

    return res.status(201).json({
      message: "Task created successfully",
      task: task.toJSON(),
    });
  } catch (error) {
    console.error("Create task error:", error);
    return res.status(500).json({
      message: "An error occurred while creating the task.",
    });
  }
};

// Get all tasks for authenticated user
export const getTasks = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { workspaceId } = req.query;

  try {
    const query: any = {
      $or: [
        { creatorId: req.user.userId },
        { 
          $and: [
            { isPrivate: { $ne: true } },
            { $or: [{ partnerId: req.user.userId }, { collaboratorIds: req.user.userId }] }
          ]
        }
      ]
    };

    if (workspaceId !== undefined) {
      if (workspaceId === 'null' || workspaceId === 'none') {
        query.workspaceId = null;
      } else {
        query.workspaceId = workspaceId;
      }
    }

    // Sort by createdAt descending so newly created tasks appear immediately at the top
    const tasks = await Task.find(query)
      .populate('creatorId', 'username name image')
      .populate('partnerId', 'username name image')
      .populate('collaboratorIds', 'username name image')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      tasks: tasks.map(task => task.toJSON()),
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    return res.status(500).json({
      message: "An error occurred while retrieving tasks.",
    });
  }
};

// Get a single task by ID
export const getTaskById = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { id } = req.params;

  try {
    const task = await Task.findById(id)
      .populate('creatorId', 'username name image')
      .populate('partnerId', 'username name image')
      .populate('collaboratorIds', 'username name image');

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    if (!checkOwnership(task, req)) {
      return res.status(403).json({
        message: "You do not have permission to view this task.",
      });
    }

    return res.status(200).json({
      task: task.toJSON(),
    });
  } catch (error) {
    console.error("Get task by ID error:", error);
    return res.status(500).json({
      message: "An error occurred while retrieving the task.",
    });
  }
};

// Update a task
export const updateTask = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { id } = req.params;
  const validatedFields = TaskUpdateSchema.safeParse(req.body);

  if (!validatedFields.success) {
    return res.status(400).json({
      errors: validatedFields.error.flatten().fieldErrors,
    });
  }

  try {
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    if (!checkOwnership(task, req)) {
      return res.status(403).json({
        message: "You do not have permission to update this task.",
      });
    }

    // Apply updates
    const updates = validatedFields.data;
    if (updates.title !== undefined) task.title = updates.title;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.dueDate !== undefined) {
      if (updates.dueDate && new Date(updates.dueDate) <= new Date()) {
        return res.status(400).json({
          message: "Target due date must be in the future.",
        });
      }
      task.dueDate = updates.dueDate;
    }
    if (updates.workspaceId !== undefined) {
      task.workspaceId = (updates.workspaceId as any) || null;
    }
    if (updates.isPrivate !== undefined) {
      task.isPrivate = !!updates.isPrivate;
      if (task.isPrivate) {
        task.partnerId = null;
        task.collaboratorIds = [];
      }
    }
    if (updates.partnerId !== undefined) {
      if (updates.partnerId) {
        return res.status(400).json({
          message: "Collaborators must be added through accepted invites.",
        });
      }
      if (!checkCreator(task, req)) {
        return res.status(403).json({
          message: "Only the task creator can remove a partner.",
        });
      }
      task.partnerId = null;
    }

    await task.save();

    if (updates.status !== undefined) {
      const otherParticipantIds = getTaskParticipantIds(task).filter((userId) => userId !== req.user.userId);
      await Promise.all(otherParticipantIds.map((userId) => createNotification({
        userId,
        type: 'TASK_UPDATED',
        title: 'Task status updated',
        message: `"${task.title}" moved to ${task.status.toLowerCase().replace('_', ' ')}.`,
        taskId: task._id,
      })));
    }

    await task.populate([
      { path: 'creatorId', select: 'username name image' },
      { path: 'partnerId', select: 'username name image' },
      { path: 'collaboratorIds', select: 'username name image' }
    ]);

    return res.status(200).json({
      message: "Task updated successfully",
      task: task.toJSON(),
    });
  } catch (error) {
    console.error("Update task error:", error);
    return res.status(500).json({
      message: "An error occurred while updating the task.",
    });
  }
};

// Delete a task
export const deleteTask = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { id } = req.params;

  try {
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    // Strict check: only creator can delete
    if (!checkCreator(task, req)) {
      return res.status(403).json({
        message: "You do not have permission to delete this task.",
      });
    }

    await task.deleteOne();

    return res.status(200).json({
      message: "Task deleted successfully.",
      id,
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return res.status(500).json({
      message: "An error occurred while deleting the task.",
    });
  }
};

// Get aggregated dashboard data
export const getDashboardData = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const userId = req.user.userId;

  try {
    // 1. Fetch all tasks where user is creator, or partner/collaborator on a public task
    const allTasks = await Task.find({
      $or: [
        { creatorId: userId },
        { 
          $and: [
            { isPrivate: { $ne: true } },
            { $or: [{ partnerId: userId }, { collaboratorIds: userId }] }
          ]
        }
      ]
    })
    .populate('creatorId', 'username name image')
    .populate('partnerId', 'username name image')
    .populate('collaboratorIds', 'username name image')
    .sort({ createdAt: -1 });

    // 2. Compute stats
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const inProgressTasks = allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const pendingTasks = allTasks.filter(t => t.status === TaskStatus.PENDING).length;
    const sharedTasks = allTasks.filter(t => getTaskParticipantIds(t).length > 1).length;

    // Overdue tasks: status is not COMPLETED, has a dueDate, and dueDate is in the past relative to now
    const now = new Date();
    const overdueTasks = allTasks.filter(t => {
      if (t.status === TaskStatus.COMPLETED || !t.dueDate) return false;
      return new Date(t.dueDate) < now;
    }).sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });

    const overdueCount = overdueTasks.length;

    // 3. Upcoming Deadlines: Active (not COMPLETED), due date is in the future
    const upcomingDeadlines = allTasks.filter(t => {
      if (t.status === TaskStatus.COMPLETED || !t.dueDate) return false;
      return new Date(t.dueDate) >= now;
    }).sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    }).slice(0, 5); // Limit to top 5 upcoming

    // 4. Shared Tasks Center: tasks containing both creator and partner information
    const sharedTasksList = allTasks.filter(t => getTaskParticipantIds(t).length > 1);

    const latestCheckIns = await CheckIn.find({ taskId: { $in: allTasks.map((t) => t._id) } })
      .populate('userId', 'username name image')
      .populate('taskId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    // 5. Recent Activity Feed: Dynamic feed generated from recent task changes
    const sortedByUpdate = [...allTasks].sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    const taskActivities = sortedByUpdate.slice(0, 10).map(t => {
      const isUserCreator = getIdString(t.creatorId);
      const creatorName = isUserCreator === userId ? 'You' : `@${(t.creatorId as any)?.username || 'partner'}`;
      
      let text = '';
      if (t.status === TaskStatus.COMPLETED) {
        text = `${creatorName} completed '${t.title}'`;
      } else if (t.status === TaskStatus.IN_PROGRESS) {
        text = `${creatorName} started working on '${t.title}'`;
      } else {
        const diffMs = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
        if (diffMs < 5000) {
          text = `${creatorName} created task '${t.title}'`;
        } else {
          text = `${creatorName} updated task '${t.title}'`;
        }
      }

      const timeDiffMin = Math.round((now.getTime() - new Date(t.updatedAt).getTime()) / 60000);
      let timeStr = 'Just now';
      if (timeDiffMin > 0) {
        if (timeDiffMin < 60) {
          timeStr = `${timeDiffMin}m ago`;
        } else {
          const hours = Math.round(timeDiffMin / 60);
          if (hours < 24) {
            timeStr = `${hours}h ago`;
          } else {
            timeStr = new Date(t.updatedAt).toLocaleDateString();
          }
        }
      }

      return {
        id: t._id.toString() + '-' + t.updatedAt,
        text,
        time: timeStr,
        createdAt: t.updatedAt
      };
    });

    const checkInActivities = latestCheckIns.map((checkIn: any) => {
      const actorId = getIdString(checkIn.userId);
      const actorName = actorId === userId ? 'You' : `@${checkIn.userId?.username || 'partner'}`;
      const createdAt = new Date(checkIn.createdAt);
      const timeDiffMin = Math.round((now.getTime() - createdAt.getTime()) / 60000);
      let timeStr = 'Just now';
      if (timeDiffMin > 0) {
        if (timeDiffMin < 60) timeStr = `${timeDiffMin}m ago`;
        else if (timeDiffMin < 1440) timeStr = `${Math.round(timeDiffMin / 60)}h ago`;
        else timeStr = createdAt.toLocaleDateString();
      }

      return {
        id: checkIn._id.toString(),
        text: `${actorName} posted a ${checkIn.status.toLowerCase().replace('_', ' ')} check-in on '${checkIn.taskId?.title || 'a task'}'`,
        time: timeStr,
        createdAt,
      };
    });

    const activities = [...taskActivities, ...checkInActivities]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(({ createdAt, ...activity }) => activity);

    // 6. Check-in Reminders
    const activeSharedTasks = sharedTasksList.filter(t => t.status !== TaskStatus.COMPLETED);
    const checkInReminders = activeSharedTasks.slice(0, 3).map(t => {
      const isCreatorSelf = (t.creatorId as any)?._id?.toString() === userId;
      const collaborator = (t.collaboratorIds as any[])?.find((participant: any) => getIdString(participant) !== userId);
      const partnerUser = collaborator || (isCreatorSelf ? t.partnerId : t.creatorId);
      const partnerName = (partnerUser as any)?.name || `@${(partnerUser as any)?.username || 'partner'}`;
      return {
        taskId: t._id.toString(),
        taskTitle: t.title,
        partnerName,
        message: `Send check-in update to ${partnerName} for '${t.title}'`
      };
    });

    return res.status(200).json({
      stats: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        overdueTasks: overdueCount,
        sharedTasks
      },
      allTasks: allTasks.map(t => t.toJSON()),
      overdueTasks: overdueTasks.map(t => t.toJSON()),
      upcomingDeadlines: upcomingDeadlines.map(t => t.toJSON()),
      sharedTasks: sharedTasksList.map(t => t.toJSON()),
      activities,
      checkInReminders
    });

  } catch (error) {
    console.error("Get dashboard data error:", error);
    return res.status(500).json({
      message: "An error occurred while retrieving dashboard data.",
    });
  }
};
