import api from './api';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'MISSED' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskVisibility = 'PRIVATE' | 'SELECTED_PARTNERS' | 'WORKSPACE';
export type ProgressMode = 'AUTO' | 'MANUAL';
export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type VerificationStatus = 'NOT_REQUESTED' | 'PENDING' | 'VERIFIED' | 'NEEDS_CLARIFICATION';
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface UserSummary {
  id: string;
  username: string;
  name?: string;
  image?: string;
  xp?: number;
  level?: number;
}

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: string | null;
  dueDate?: string | null;
  order: number;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: string | null;
  status: MilestoneStatus;
  completedAt?: string | null;
  linkedSubtaskIds?: string[];
  order: number;
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[];
  endDate?: string | null;
  count?: number | null;
  timezone?: string;
}

export interface RescheduleRecord {
  previousDueDate: string | null;
  newDueDate: string;
  reason?: string;
  rescheduledBy: string | UserSummary;
  rescheduledAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  creatorId: string | UserSummary;
  ownerId?: string | UserSummary;
  partnerId?: string | UserSummary | null;
  collaboratorIds?: UserSummary[];
  sharedWithIds?: UserSummary[];
  visibility?: TaskVisibility;
  role?: 'OWNER' | 'MONITOR';
  permissions?: {
    isOwner: boolean;
    canView: boolean;
    canComment: boolean;
    canManage: boolean;
    role: 'OWNER' | 'MONITOR' | 'NONE';
  };
  isPrivate?: boolean;
  workspaceId?: string | null;
  createdAt: string;
  updatedAt: string;

  // Stage 2
  subtasks?: Subtask[];
  milestones?: Milestone[];
  progress?: number;
  progressMode?: ProgressMode;
  manualProgress?: number;
  recurrence?: RecurrenceRule;
  recurringSeriesId?: string | null;
  occurrenceIndex?: number;
  isRecurringInstance?: boolean;
  isOverdue?: boolean;
  rescheduleHistory?: RescheduleRecord[];
  verificationRequired?: boolean;
  verifierId?: string | UserSummary | null;
  verificationStatus?: VerificationStatus;
  verificationNotes?: string;
  verifiedAt?: string | null;
  clarificationRequestedAt?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  isPrivate?: boolean;
  visibility?: TaskVisibility;
  sharedWithIds?: string[];
  workspaceId?: string | null;
  subtasks?: Array<{ title: string; description?: string; dueDate?: string | null }>;
  milestones?: Array<{ title: string; description?: string; targetDate?: string | null }>;
  progressMode?: ProgressMode;
  manualProgress?: number;
  recurrence?: RecurrenceRule;
  verificationRequired?: boolean;
  verifierId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  partnerId?: string | null;
  isPrivate?: boolean;
  visibility?: TaskVisibility;
  sharedWithIds?: string[];
  workspaceId?: string | null;
  progressMode?: ProgressMode;
  manualProgress?: number;
  recurrence?: RecurrenceRule;
  verificationRequired?: boolean;
  verifierId?: string | null;
  editScope?: 'THIS_INSTANCE' | 'FUTURE_INSTANCES' | 'ALL_INSTANCES';
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  dueTodayTasks?: number;
  overdueTasks: number;
  sharedTasks: number;
  monitoringTasks?: number;
  xp?: number;
  level?: number;
  currentStreak?: number;
  longestStreak?: number;
}

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface UserGamification {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  achievements: AchievementItem[];
  onboardingCompleted: boolean;
}

export interface NeedsAttentionItem {
  id: string;
  type: 'INVITE' | 'PROGRESS_REQUEST' | 'VERIFICATION_REQUEST' | 'OVERDUE_TASK';
  title: string;
  message: string;
  link: string;
  actionType?: string;
  inviteId?: string;
  taskId?: string;
  requestId?: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  actor: UserSummary;
  taskId?: string;
  taskTitle?: string;
  timestamp: string;
}

export interface CheckInReminder {
  taskId: string;
  taskTitle: string;
  partnerName: string;
  message: string;
}

export interface DashboardData {
  stats: DashboardStats;
  userGamification?: UserGamification;
  allTasks: Task[];
  myTasks?: Task[];
  monitoringTasks?: Task[];
  dueTodayTasks?: Task[];
  overdueTasks: Task[];
  upcomingDeadlines: Task[];
  needsAttention?: NeedsAttentionItem[];
  activities: ActivityItem[];
  checkInReminders: CheckInReminder[];
}

export interface TimelineEvent {
  type: string;
  title: string;
  description: string;
  actor?: UserSummary;
  timestamp: string;
  evidence?: any[];
  progress?: number;
  status?: string;
}

export interface ProgressRequestItem {
  id: string;
  taskId: string;
  ownerId: string;
  requesterId: UserSummary;
  status: 'PENDING' | 'RESPONDED' | 'MUTED';
  message: string;
  requestedAt: string;
  respondedAt?: string | null;
  responseNotes?: string;
}

export const taskService = {
  // Get all tasks for authenticated user
  getTasks: async (workspaceId?: string): Promise<Task[]> => {
    const params = workspaceId ? { workspaceId } : {};
    const response = await api.get('/tasks', { params });
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

  // Reschedule task
  rescheduleTask: async (id: string, data: { newDueDate: string; reason?: string }): Promise<Task> => {
    const response = await api.post(`/tasks/${id}/reschedule`, data);
    return response.data.task;
  },

  // Completion Verification
  verifyTask: async (id: string, data: { decision: 'VERIFY' | 'REQUEST_CLARIFICATION'; notes?: string }): Promise<Task> => {
    const response = await api.post(`/tasks/${id}/verify`, data);
    return response.data.task;
  },

  // Subtasks
  addSubtask: async (taskId: string, subtask: { title: string; description?: string; dueDate?: string | null }): Promise<Task> => {
    const response = await api.post(`/tasks/${taskId}/subtasks`, subtask);
    return response.data.task;
  },

  updateSubtask: async (taskId: string, subtaskId: string, updates: Partial<Subtask>): Promise<Task> => {
    const response = await api.put(`/tasks/${taskId}/subtasks/${subtaskId}`, updates);
    return response.data.task;
  },

  deleteSubtask: async (taskId: string, subtaskId: string): Promise<Task> => {
    const response = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
    return response.data.task;
  },

  toggleSubtask: async (taskId: string, subtaskId: string): Promise<Task> => {
    const response = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`);
    return response.data.task;
  },

  // Milestones
  addMilestone: async (taskId: string, milestone: { title: string; description?: string; targetDate?: string | null; linkedSubtaskIds?: string[] }): Promise<Task> => {
    const response = await api.post(`/tasks/${taskId}/milestones`, milestone);
    return response.data.task;
  },

  updateMilestone: async (taskId: string, milestoneId: string, updates: Partial<Milestone>): Promise<Task> => {
    const response = await api.put(`/tasks/${taskId}/milestones/${milestoneId}`, updates);
    return response.data.task;
  },

  deleteMilestone: async (taskId: string, milestoneId: string): Promise<Task> => {
    const response = await api.delete(`/tasks/${taskId}/milestones/${milestoneId}`);
    return response.data.task;
  },

  // Timeline
  getTaskTimeline: async (taskId: string): Promise<TimelineEvent[]> => {
    const response = await api.get(`/tasks/${taskId}/timeline`);
    return response.data.timeline;
  },

  // Progress Requests
  createProgressRequest: async (taskId: string, message?: string): Promise<ProgressRequestItem> => {
    const response = await api.post(`/tasks/${taskId}/progress-requests`, { message });
    return response.data.progressRequest;
  },

  listProgressRequests: async (taskId: string): Promise<ProgressRequestItem[]> => {
    const response = await api.get(`/tasks/${taskId}/progress-requests`);
    return response.data.progressRequests;
  },

  respondProgressRequest: async (taskId: string, requestId: string, responseNotes?: string): Promise<ProgressRequestItem> => {
    const response = await api.patch(`/tasks/${taskId}/progress-requests/${requestId}/respond`, { responseNotes });
    return response.data.progressRequest;
  },

  muteProgressRequest: async (taskId: string, requestId: string): Promise<void> => {
    await api.patch(`/tasks/${taskId}/progress-requests/${requestId}/mute`);
  },

  // Evidence
  uploadEvidence: async (taskId: string, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/tasks/${taskId}/evidence/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.evidence;
  },

  // Remove collaborator from task
  removeCollaboratorFromTask: async (id: string, partnerId: string): Promise<void> => {
    await api.delete(`/tasks/${id}/partners/${partnerId}`);
  },
};
