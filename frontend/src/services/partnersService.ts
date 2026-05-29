import api from './api';

export interface PartnerRelation {
  id: string;
  senderId: {
    id: string;
    username: string;
    name?: string;
    bio?: string;
    image?: string;
  };
  receiverId: {
    id: string;
    username: string;
    name?: string;
    bio?: string;
    image?: string;
  };
  mode: 'MUTUAL' | 'SINGLE';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
  updatedAt: string;
}

export const partnersService = {
  getPartners: async (): Promise<PartnerRelation[]> => {
    const response = await api.get('/profiles/partners');
    return response.data.relations;
  },

  invitePartner: async (username: string, mode: 'MUTUAL' | 'SINGLE'): Promise<any> => {
    const response = await api.post('/profiles/partners/invite', { username, mode });
    return response.data;
  },

  acceptPartnerInvite: async (relationId: string): Promise<any> => {
    const response = await api.post(`/profiles/partners/accept/${relationId}`);
    return response.data;
  },

  declinePartnerInvite: async (relationId: string): Promise<any> => {
    const response = await api.post(`/profiles/partners/decline/${relationId}`);
    return response.data;
  },

  removePartner: async (relationId: string): Promise<any> => {
    const response = await api.delete(`/profiles/partners/${relationId}`);
    return response.data;
  }
};
