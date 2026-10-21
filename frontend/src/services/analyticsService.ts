import api from './api';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'custom' | 'weekly' | 'monthly';

export interface PartnerInsightItem {
  partnerId: string;
  username: string;
  name?: string;
  image?: string;
  mode: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

export interface WorkspaceInsightItem {
  workspaceId: string;
  name: string;
  isDefault: boolean;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  overdueTasks: number;
}

export interface AnalyticsData {
  range: string;
  start: string;
  end: string;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
    totalCheckIns: number;
    checkInConsistency: number;
    completedCheckIns: number;
    inProgressCheckIns: number;
    missedCheckIns: number;
    milestones?: {
      total: number;
      completed: number;
      rate: number;
    };
    recurringAdherence?: number;
    streak?: {
      current: number;
    };
  };
  activityByDay: Record<string, { checkIns: number; completions: number } | number>;
  workspaces?: WorkspaceInsightItem[];
  partners?: PartnerInsightItem[];
  partnerInsights?: {
    monitoredTasksCount: number;
    feedbackGivenCount: number;
    pendingVerificationsCount: number;
    pendingProgressRequestsCount: number;
  };
}

export const analyticsService = {
  getAnalytics: async (range: AnalyticsRange = '7d', start?: string, end?: string): Promise<AnalyticsData> => {
    let url = `/analytics?range=${range}`;
    if (start) url += `&start=${encodeURIComponent(start)}`;
    if (end) url += `&end=${encodeURIComponent(end)}`;
    const response = await api.get(url);
    return response.data;
  },
};
