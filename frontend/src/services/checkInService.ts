import api from './api';
import type { UserSummary } from './taskService';

export type CheckInStatus = 'COMPLETED' | 'IN_PROGRESS' | 'MISSED';

export interface CheckIn {
  id: string;
  status: CheckInStatus;
  notes: string;
  taskId: string;
  userId: UserSummary;
  createdAt: string;
  updatedAt: string;
}

export const checkInService = {
  listCheckIns: async (taskId: string): Promise<CheckIn[]> => {
    const response = await api.get(`/tasks/${taskId}/check-ins`);
    return response.data.checkIns;
  },

  createCheckIn: async (taskId: string, input: { status: CheckInStatus; notes?: string }): Promise<CheckIn> => {
    const response = await api.post(`/tasks/${taskId}/check-ins`, input);
    return response.data.checkIn;
  },
};
