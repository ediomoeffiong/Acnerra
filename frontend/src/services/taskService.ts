import api from './api';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  creatorId: string;
  partnerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export const taskService = {
  // Get all tasks for authenticated user
  getTasks: async (): Promise<Task[]> => {
    const response = await api.get('/tasks');
    return response.data.tasks;
  },

  // Get a single task by ID
  getTask: async (id: string): Promise<Task> => {
    const response = await api.get(`/tasks/${id}`);
    return response.data.task;
  },

  // Create a new task
  createTask: async (input: CreateTaskInput): Promise<Task> => {
    const response = await api.post('/tasks', input);
    return response.data.task;
  },

  // Update an existing task
  updateTask: async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const response = await api.put(`/tasks/${id}`, input);
    return response.data.task;
  },

  // Delete a task
  deleteTask: async (id: string): Promise<{ message: string; id: string }> => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },
};
