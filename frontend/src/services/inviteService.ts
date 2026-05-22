import api from './api';
import type { Task, UserSummary } from './taskService';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface Invite {
  id: string;
  senderId: UserSummary;
  receiverId: UserSummary;
  taskId: Pick<Task, 'id' | 'title' | 'status' | 'dueDate'>;
  status: InviteStatus;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const inviteService = {
  listInvites: async (): Promise<Invite[]> => {
    const response = await api.get('/invites');
    return response.data.invites;
  },

  sendInvite: async (input: { username: string; taskId: string }): Promise<Invite> => {
    const response = await api.post('/invites', input);
    return response.data.invite;
  },

  acceptInvite: async (id: string): Promise<{ invite: Invite; task: Task }> => {
    const response = await api.post(`/invites/${id}/accept`);
    return response.data;
  },

  declineInvite: async (id: string): Promise<Invite> => {
    const response = await api.post(`/invites/${id}/decline`);
    return response.data.invite;
  },
};
