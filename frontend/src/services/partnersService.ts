import api from './api';
import type { UserSummary } from './taskService';

export const partnersService = {
  getPartners: async (): Promise<UserSummary[]> => {
    const response = await api.get('/profiles/partners');
    return response.data.partners;
  },

  addPartner: async (partnerId: string): Promise<any> => {
    const response = await api.post('/profiles/partners', { partnerId });
    return response.data;
  },

  removePartner: async (partnerId: string): Promise<any> => {
    const response = await api.delete(`/profiles/partners/${partnerId}`);
    return response.data;
  }
};
