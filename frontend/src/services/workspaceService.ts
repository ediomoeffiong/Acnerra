import api from './api';

export interface Workspace {
  id: string;
  name: string;
  userId: any;
  isDefault: boolean;
  collaboratorIds?: any[];
  createdAt: string;
  updatedAt: string;
}

export const workspaceService = {
  getWorkspaces: async (): Promise<Workspace[]> => {
    const response = await api.get('/workspaces');
    return response.data.workspaces;
  },

  createWorkspace: async (name: string): Promise<Workspace> => {
    const response = await api.post('/workspaces', { name });
    return response.data.workspace;
  },

  updateWorkspace: async (id: string, name: string): Promise<Workspace> => {
    const response = await api.put(`/workspaces/${id}`, { name });
    return response.data.workspace;
  },

  deleteWorkspace: async (id: string): Promise<void> => {
    await api.delete(`/workspaces/${id}`);
  },

  restoreDefaultWorkspaces: async (): Promise<Workspace[]> => {
    const response = await api.post('/workspaces/restore');
    return response.data.workspaces;
  },

  removePartnerFromWorkspace: async (id: string, partnerId: string): Promise<Workspace> => {
    const response = await api.delete(`/workspaces/${id}/partners/${partnerId}`);
    return response.data.workspace;
  }
};
