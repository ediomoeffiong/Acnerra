import api from './api';
import type { UserSummary } from './taskService';

export type CheckInStatus = 'COMPLETED' | 'IN_PROGRESS' | 'MISSED';

export interface EvidenceItem {
  id: string;
  type: 'LINK' | 'IMAGE' | 'DOCUMENT';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  storageKey?: string;
}

export interface CheckIn {
  id: string;
  status: CheckInStatus;
  notes: string;
  taskId: string;
  userId: UserSummary;
  kind?: 'OWNER_PROGRESS' | 'PARTNER_FEEDBACK' | null;
  progress?: number | null;
  completedWork?: string;
  blockers?: string;
  nextSteps?: string;
  isPrivate?: boolean;
  evidence?: EvidenceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCheckInInput {
  status: CheckInStatus;
  notes?: string;
  progress?: number | null;
  completedWork?: string;
  blockers?: string;
  nextSteps?: string;
  isPrivate?: boolean;
  evidence?: EvidenceItem[];
}

export const checkInService = {
  listCheckIns: async (taskId: string): Promise<CheckIn[]> => {
    const response = await api.get(`/tasks/${taskId}/check-ins`);
    return response.data.checkIns;
  },

  createCheckIn: async (taskId: string, input: CreateCheckInInput): Promise<CheckIn> => {
    const response = await api.post(`/tasks/${taskId}/check-ins`, input);
    return response.data.checkIn;
  },
};
