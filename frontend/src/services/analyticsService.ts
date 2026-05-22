import api from './api';

export interface AnalyticsData {
  range: 'weekly' | 'monthly';
  metrics: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalCheckIns: number;
    checkInConsistency: number;
    activityFrequency: number;
    completedCheckIns: number;
    inProgressCheckIns: number;
    missedCheckIns: number;
  };
  activityByDay: Record<string, number>;
}

export const analyticsService = {
  getAnalytics: async (range: 'weekly' | 'monthly' = 'weekly'): Promise<AnalyticsData> => {
    const response = await api.get(`/analytics?range=${range}`);
    return response.data;
  },
};
