import * as React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/layouts/AppLayout";
import { taskService, type Task, type DashboardData } from "../../src/services/taskService";
import { inviteService } from "../../src/services/inviteService";
import { workspaceService, type Workspace } from "../../src/services/workspaceService";

// Dashboard modular components
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { OverviewSection } from "../components/dashboard/OverviewSection";
import { NeedsAttentionSection } from "../components/dashboard/NeedsAttentionSection";
import { MyTasksSection } from "../components/dashboard/MyTasksSection";
import { MonitoringSection } from "../components/dashboard/MonitoringSection";
import { ActivitySection } from "../components/dashboard/ActivitySection";
import { AnalyticsTab } from "../components/dashboard/AnalyticsTab";
import { PartnersTab } from "../components/dashboard/PartnersTab";
import { WorkspaceTab } from "../components/dashboard/WorkspaceTab";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { NotificationsModal } from "../components/dashboard/NotificationsModal";
import { CreateTaskModal } from "../components/dashboard/CreateTaskModal";
import { RescheduleModal } from "../components/dashboard/RescheduleModal";

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();

  // Sidebar / Page active tab
  const [activeTab, setActiveTab] = React.useState<string>(() => {
    return (location.state as any)?.activeTab || "dashboard";
  });

  React.useEffect(() => {
    if (location.state && (location.state as any).activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);

  // Data State
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [taskFilterOverride, setTaskFilterOverride] = React.useState<string>("ALL");

  // Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = React.useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [rescheduleTaskTarget, setRescheduleTaskTarget] = React.useState<Task | null>(null);

  // Check if first-time onboarding should be displayed
  React.useEffect(() => {
    if (user && user.onboardingCompleted === false) {
      setIsOnboardingOpen(true);
    }
  }, [user]);

  // Load Dashboard Data (Clean, single targeted load without repetitive 5-second polling)
  const loadDashboardData = React.useCallback(async () => {
    try {
      const [data, wsList] = await Promise.all([
        taskService.getDashboardData(),
        workspaceService.getWorkspaces().catch(() => []),
      ]);
      setDashboardData(data);
      setWorkspaces(wsList);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Quick Action Handlers
  const handleCompleteTask = async (taskId: string) => {
    try {
      await taskService.updateTask(taskId, { status: "COMPLETED" });
      await loadDashboardData();
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await inviteService.acceptInvite(inviteId);
      await loadDashboardData();
    } catch (err) {
      console.error("Failed to accept invite:", err);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await inviteService.declineInvite(inviteId);
      await loadDashboardData();
    } catch (err) {
      console.error("Failed to decline invite:", err);
    }
  };

  const handleOpenRescheduleModal = (taskId: string) => {
    const task = dashboardData?.myTasks?.find((t) => t.id === taskId) || null;
    if (task) {
      setRescheduleTaskTarget(task);
    }
  };

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "workspace" ? (
        <WorkspaceTab
          tasks={dashboardData?.allTasks || []}
          workspaces={workspaces}
          onWorkspaceCreated={loadDashboardData}
          onSelectWorkspaceFilter={(_wsId) => {
            setActiveTab("dashboard");
          }}
        />
      ) : activeTab === "analytics" ? (
        <AnalyticsTab />
      ) : activeTab === "partners" ? (
        <PartnersTab />
      ) : (
        /* MAIN DASHBOARD VIEW */
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <DashboardHeader
            user={user}
            gamification={dashboardData?.userGamification}
            unreadNotificationsCount={unreadNotifications}
            onOpenNewTask={() => setIsTaskModalOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onOpenTour={() => setIsOnboardingOpen(true)}
          />

          {loading ? (
            <div className="p-16 text-center text-zinc-500 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading your commitments and progress...
            </div>
          ) : dashboardData ? (
            <div className="space-y-8">
              {/* Overview Metrics */}
              <OverviewSection
                stats={dashboardData.stats}
                achievements={dashboardData.userGamification?.achievements}
                onSelectTab={setActiveTab}
                onFilterOverdue={() => setTaskFilterOverride("OVERDUE")}
                onFilterDueToday={() => setTaskFilterOverride("ALL")}
              />

              {/* Needs Attention Section (Invites, Progress Requests, Verifications, Overdue) */}
              {dashboardData.needsAttention && dashboardData.needsAttention.length > 0 && (
                <NeedsAttentionSection
                  items={dashboardData.needsAttention}
                  onAcceptInvite={handleAcceptInvite}
                  onDeclineInvite={handleDeclineInvite}
                  onOpenRescheduleModal={handleOpenRescheduleModal}
                />
              )}

              {/* My Tasks Section (Strictly Owned Tasks) */}
              <MyTasksSection
                tasks={dashboardData.myTasks || []}
                workspaces={workspaces}
                onCompleteTask={handleCompleteTask}
                onOpenRescheduleModal={handleOpenRescheduleModal}
                onOpenNewTask={() => setIsTaskModalOpen(true)}
                initialFilter={taskFilterOverride}
              />

              {/* Monitoring Section (Tasks Belonging to Other Users) */}
              <MonitoringSection
                tasks={dashboardData.monitoringTasks || []}
              />

              {/* Activity Section */}
              <ActivitySection
                activities={dashboardData.activities || []}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Modals */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onTaskCreated={loadDashboardData}
      />

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskCreated={loadDashboardData}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadCountChange={setUnreadNotifications}
      />

      <RescheduleModal
        task={rescheduleTaskTarget}
        isOpen={Boolean(rescheduleTaskTarget)}
        onClose={() => setRescheduleTaskTarget(null)}
        onRescheduled={loadDashboardData}
      />
    </AppLayout>
  );
}
