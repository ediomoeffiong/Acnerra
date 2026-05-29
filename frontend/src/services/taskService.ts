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
  creatorId: string | UserSummary;
  partnerId?: string | UserSummary | null;
  collaboratorIds?: UserSummary[];
  isPrivate?: boolean;
  workspaceId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  username: string;
  name?: string;
  image?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  isPrivate?: boolean;
  workspaceId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  partnerId?: string | null;
  isPrivate?: boolean;
  workspaceId?: string | null;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  sharedTasks: number;
}

export interface ActivityLog {
  id: string;
  text: string;
  time: string;
}

export interface CheckInReminder {
  taskId: string;
  taskTitle: string;
  partnerName: string;
  message: string;
}

export interface DashboardData {
  stats: DashboardStats;
  allTasks: Task[];
  overdueTasks: Task[];
  upcomingDeadlines: Task[];
  sharedTasks: Task[];
  activities: ActivityLog[];
  checkInReminders: CheckInReminder[];
}

export const taskService = {
  // Get all tasks for authenticated user
  getTasks: async (): Promise<Task[]> => {
    const response = await api.get('/tasks');
    return response.data.tasks;
  },

  // Get aggregated dashboard data
  getDashboardData: async (): Promise<DashboardData> => {
    const response = await api.get('/tasks/dashboard');
    return response.data;
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
