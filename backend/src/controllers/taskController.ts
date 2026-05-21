import { Request, Response } from 'express';
import { z } from 'zod';
import { Task, TaskStatus, TaskPriority } from '../models/Task';

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
});

// Helper for ownership validation
const checkOwnership = (task: any, req: any): boolean => {
  return task && task.creatorId && task.creatorId.toString() === req.user.userId;
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

  const { title, description, status, priority, dueDate } = validatedFields.data;
  const creatorId = req.user.userId;

  try {
    const task = new Task({
      title,
      description,
      status,
      priority,
      dueDate,
      creatorId,
    });

    await task.save();

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

  const creatorId = req.user.userId;

  try {
    // Sort by createdAt descending so newly created tasks appear immediately at the top
    const tasks = await Task.find({ creatorId }).sort({ createdAt: -1 });

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
    const task = await Task.findById(id);

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
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;

    await task.save();

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

    if (!checkOwnership(task, req)) {
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
