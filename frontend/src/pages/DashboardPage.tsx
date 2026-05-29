import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/layouts/AppLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { 
  Plus, CheckCircle2, Circle, Clock, Trash2, UserPlus, 
  ArrowUpCircle, Flame, Calendar, Award, ExternalLink,
  AlertTriangle, Bell
} from "lucide-react";
import { taskService } from "../services/taskService";
import type { Task, DashboardData } from "../services/taskService";
import { inviteService } from "../services/inviteService";
import type { Invite } from "../services/inviteService";
import { checkInService } from "../services/checkInService";
import type { CheckInStatus } from "../services/checkInService";
import { analyticsService } from "../services/analyticsService";
import type { AnalyticsData } from "../services/analyticsService";
import api from "../services/api";

interface Buddy {
  id: string;
  name: string;
  username: string;
  status: "active" | "pending";
}



export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("dashboard");

  // State loaded from API
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = React.useState(true);

  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [inviteTaskId, setInviteTaskId] = React.useState("");
  const [inviteFeedback, setInviteFeedback] = React.useState<string | null>(null);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [submittingInvite, setSubmittingInvite] = React.useState(false);

  // Profile Edit States
  const [profileBio, setProfileBio] = React.useState(() => {
    return localStorage.getItem("acnerra_bio") || "";
  });

  // Modals Toggles
  const [isTaskModalOpen, setIsTaskModalOpen] = React.useState(false);
  const [isBuddyModalOpen, setIsBuddyModalOpen] = React.useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = React.useState(false);

  // New Forms State
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDesc, setNewTaskDesc] = React.useState("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"high" | "medium" | "low">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = React.useState("");
  const [checkInTaskId, setCheckInTaskId] = React.useState("");
  const [checkInStatus, setCheckInStatus] = React.useState<CheckInStatus>("IN_PROGRESS");
  const [checkInNotes, setCheckInNotes] = React.useState("");

  // Buddy Search state
  const [buddySearchQuery, setBuddySearchQuery] = React.useState("");
  const [searchedProfiles, setSearchedProfiles] = React.useState<any[]>([]);
  const [searchingProfiles, setSearchingProfiles] = React.useState(false);

  const [editBioText, setEditBioText] = React.useState(profileBio);

  // Load Dashboard Data & Tasks
  // Load Dashboard Data & Tasks
  const loadDashboardData = React.useCallback(async (background = false) => {
    try {
      if (!background) setLoadingDashboard(true);
      const data = await taskService.getDashboardData();
      setDashboardData(data);
      setTasks(data.allTasks || []);
      const [inviteList, analyticsData] = await Promise.all([
        inviteService.listInvites(),
        analyticsService.getAnalytics("weekly"),
      ]);
      setInvites(inviteList);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error("Failed to load dashboard data from API:", error);
    } finally {
      if (!background) setLoadingDashboard(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboardData();
    
    const interval = setInterval(() => {
      loadDashboardData(true); // background load every 5 seconds
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Debounced search for profiles
  React.useEffect(() => {
    if (!buddySearchQuery.trim()) {
      setSearchedProfiles([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        setSearchingProfiles(true);
        const response = await api.get(`/profiles?query=${encodeURIComponent(buddySearchQuery)}`);
        setSearchedProfiles(response.data.profiles || []);
      } catch (err) {
        console.error("Error searching profiles:", err);
      } finally {
        setSearchingProfiles(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [buddySearchQuery]);

  const buddies = React.useMemo<Buddy[]>(() => {
    const partnerMap = new Map<string, Buddy>();
    (dashboardData?.sharedTasks || []).forEach((task) => {
      const participants = [
        task.creatorId,
        task.partnerId,
        ...(task.collaboratorIds || []),
      ].filter(Boolean) as any[];

      participants.forEach((participant) => {
        const id = participant?.id || participant?._id;
        if (!id || id === user?.id) return;
        partnerMap.set(id, {
          id,
          name: participant.name || participant.username,
          username: participant.username,
          status: "active",
        });
      });
    });

    invites.filter((invite) => invite.status === "PENDING").forEach((invite) => {
      const participant = invite.senderId.id === user?.id ? invite.receiverId : invite.senderId;
      if (!partnerMap.has(participant.id)) {
        partnerMap.set(participant.id, {
          id: participant.id,
          name: participant.name || participant.username,
          username: participant.username,
          status: "pending",
        });
      }
    });

    return Array.from(partnerMap.values());
  }, [dashboardData?.sharedTasks, invites, user?.id]);

  // Actions
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await taskService.createTask({
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority.toUpperCase() as any,
        dueDate: newTaskDueDate || null,
      });

      await loadDashboardData();
      
      // Reset Form & Close
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
      setNewTaskDueDate("");
      setIsTaskModalOpen(false);
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleSendInvite = async (profile: any) => {
    if (!inviteTaskId) {
      setInviteError("Choose a task before sending the invite.");
      return;
    }

    try {
      setSubmittingInvite(true);
      setInviteError(null);
      setInviteFeedback(null);
      await inviteService.sendInvite({ username: profile.username, taskId: inviteTaskId });
      setInviteFeedback(`Invite sent to @${profile.username}.`);
      setInvites(await inviteService.listInvites());
    } catch (error: any) {
      setInviteError(error.response?.data?.message || "Invite could not be sent.");
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleInviteResponse = async (id: string, action: "accept" | "decline") => {
    try {
      if (action === "accept") {
        await inviteService.acceptInvite(id);
      } else {
        await inviteService.declineInvite(id);
      }
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to update invite:", error);
    }
  };

  const handleQuickCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInTaskId) return;

    try {
      await checkInService.createCheckIn(checkInTaskId, {
        status: checkInStatus,
        notes: checkInNotes,
      });
      setCheckInNotes("");
      setCheckInStatus("IN_PROGRESS");
      setCheckInTaskId("");
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to submit check-in:", error);
    }
  };

  const handleToggleTaskStatus = async (id: string) => {
    const taskToToggle = tasks.find(t => t.id === id);
    if (!taskToToggle) return;

    let nextStatus: Task["status"] = "PENDING";
    if (taskToToggle.status === "PENDING") nextStatus = "IN_PROGRESS";
    else if (taskToToggle.status === "IN_PROGRESS") nextStatus = "COMPLETED";

    try {
      await taskService.updateTask(id, { status: nextStatus });
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to toggle task status:", error);
    }
  };

  const handleDeleteTask = async (id: string, title: string) => {
    try {
      console.log("Deleting task:", title);
      await taskService.deleteTask(id);
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleSaveBio = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBio(editBioText);
    localStorage.setItem("acnerra_bio", editBioText);
    setIsEditProfileModalOpen(false);
  };

  // Metrics
  const stats = dashboardData?.stats || {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    sharedTasks: 0
  };
  const formatDeadline = (dueDate: string | null) => {
    if (!dueDate) return "No target date";
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`;
    } else if (diffDays === 0) {
      return "Due Today";
    } else if (diffDays === 1) {
      return "Due Tomorrow";
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    } else {
      return `Due on ${due.toLocaleDateString()}`;
    }
  };

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "dashboard" ? (
        <div className="space-y-8">
          {/* Welcome Intro Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Your Accountability Space</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Maintain consistency with your partners. Double your daily output velocity.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setIsTaskModalOpen(true)} className="h-9 font-semibold text-xs">
                <Plus className="mr-1.5 h-4 w-4" /> Create Task
              </Button>
              <Button onClick={() => setIsBuddyModalOpen(true)} variant="secondary" className="h-9 font-semibold text-xs">
                <UserPlus className="mr-1.5 h-4 w-4" /> Link Partner
              </Button>
            </div>
          </div>

          {/* SaaS Metrics Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-zinc-950/40 border-zinc-900">
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Total Tasks
                <Clock className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-zinc-100 mt-2">{stats.totalTasks}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Assigned accountability targets</p>
            </Card>

            <Card className="p-4 bg-zinc-950/40 border-zinc-900">
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                In Progress
                <ArrowUpCircle className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-zinc-100 mt-2">{stats.inProgressTasks}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Actively tracking right now</p>
            </Card>

            <Card className="p-4 bg-zinc-950/40 border-zinc-900">
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Completed
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-zinc-100 mt-2">{stats.completedTasks}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Verified partner checkpoints</p>
            </Card>

            {/* Overdue highlight card */}
            <Card className={`p-4 transition-all duration-300 ${stats.overdueTasks > 0 ? 'bg-red-950/30 border-red-900/60 shadow-lg shadow-red-950/20' : 'bg-zinc-950/40 border-zinc-900'}`}>
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Overdue Blockers
                <AlertTriangle className={`h-4 w-4 ${stats.overdueTasks > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-650'}`} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${stats.overdueTasks > 0 ? 'text-red-400' : 'text-zinc-100'}`}>{stats.overdueTasks}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Passed due dates without closure</p>
            </Card>
          </div>

          {analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border-zinc-900 bg-zinc-950/30">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Weekly Completion</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{analytics.metrics.completionRate}%</p>
                <p className="text-[10px] text-zinc-500 mt-1">{analytics.metrics.completedTasks} of {analytics.metrics.totalTasks} tasks completed</p>
              </Card>
              <Card className="p-4 border-zinc-900 bg-zinc-950/30">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Check-in Consistency</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">{analytics.metrics.checkInConsistency}%</p>
                <p className="text-[10px] text-zinc-500 mt-1">{analytics.metrics.totalCheckIns} check-ins this week</p>
              </Card>
              <Card className="p-4 border-zinc-900 bg-zinc-950/30">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Status Mix</p>
                <p className="text-xs text-zinc-300 mt-2">
                  {analytics.metrics.completedCheckIns} done / {analytics.metrics.inProgressCheckIns} moving / {analytics.metrics.missedCheckIns} missed
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">Based on visible shared activity</p>
              </Card>
            </div>
          ) : null}

          {/* Core Content Body - Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Block: Task Tracker Board */}
            <div className="lg:col-span-2 space-y-6">
              
              {loadingDashboard ? (
                /* Premium Skeleton Loaders */
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4 flex flex-col gap-3.5 border-zinc-900/60 bg-zinc-950/20">
                      <div className="flex items-start gap-3.5">
                        <Skeleton className="h-5 w-5 rounded-full mt-1" />
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3.5 w-12 rounded-full" />
                          </div>
                          <Skeleton className="h-3 w-3/4" />
                          <Skeleton className="h-3 w-1/4 mt-2" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  {/* Overdue Tasks List */}
                  {dashboardData?.overdueTasks && dashboardData.overdueTasks.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs tracking-wide uppercase">
                        <AlertTriangle className="h-4 w-4 animate-bounce text-red-500" />
                        <span>Urgent: Overdue Tasks ({dashboardData.overdueTasks.length})</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {dashboardData.overdueTasks.map((task) => (
                          <Card key={task.id} className="p-4 border-red-950 bg-red-950/10 hover:bg-red-950/15 hover:border-red-900 transition-all duration-300 relative group overflow-hidden shadow-md shadow-red-950/20">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/[0.02] blur-xl rounded-full pointer-events-none" />
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleTaskStatus(task.id)}
                                  className="mt-1 text-red-550 hover:text-red-400 transition-colors focus:outline-none"
                                >
                                  <Circle className="h-5 w-5" />
                                </button>
                                <div>
                                  <h3 
                                    onClick={() => navigate(`/tasks/${task.id}`)}
                                    className="text-sm font-bold text-red-200 cursor-pointer hover:underline text-left"
                                  >
                                    {task.title}
                                  </h3>
                                  <p className="text-xs text-red-400/90 mt-1 max-w-lg leading-relaxed text-left">{task.description}</p>
                                  <div className="flex items-center gap-3 mt-2.5 text-[10px] text-red-400/70 font-semibold flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5" /> Overdue since {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ""}
                                    </span>
                                    {task.partnerId && (
                                      <span className="bg-red-950/30 text-red-300 px-1.5 py-0.5 rounded border border-red-900/30">
                                        Partner: @{(task.partnerId as any).username}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTask(task.id, task.title)}
                                className="rounded-lg p-1.5 text-red-900 hover:text-red-400 hover:bg-red-950/40 transition-all focus:outline-none shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Deadlines */}
                  {dashboardData?.upcomingDeadlines && dashboardData.upcomingDeadlines.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-purple-400" /> Upcoming Targets
                      </h2>
                      <div className="space-y-3">
                        {dashboardData.upcomingDeadlines.map((task) => (
                          <Card key={task.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-zinc-800 transition-all duration-300 relative group overflow-hidden">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => handleToggleTaskStatus(task.id)}
                                className="mt-1 text-zinc-650 hover:text-indigo-400 transition-colors focus:outline-none shrink-0"
                              >
                                {task.status === "IN_PROGRESS" ? (
                                  <Clock className="h-5 w-5 text-purple-400" />
                                ) : (
                                  <Circle className="h-5 w-5 text-zinc-850" />
                                )}
                              </button>
                              <div className="text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span 
                                    onClick={() => navigate(`/tasks/${task.id}`)}
                                    className="text-sm font-semibold text-zinc-200 cursor-pointer hover:text-indigo-400 hover:underline"
                                  >
                                    {task.title}
                                  </span>
                                  <Badge variant={task.priority === "HIGH" ? "destructive" : task.priority === "MEDIUM" ? "warning" : "secondary"} className="text-[9px] px-1 py-0">
                                    {task.priority.toLowerCase()}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[9px] font-semibold bg-indigo-950/30 border border-indigo-900/30 text-indigo-400">
                                    {formatDeadline(task.dueDate)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">{task.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="self-end sm:self-auto rounded-lg p-2 text-zinc-700 hover:text-red-400 hover:bg-red-950/20 transition-all focus:outline-none"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shared Accountability board */}
                  {dashboardData?.sharedTasks && dashboardData.sharedTasks.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-emerald-400" /> Shared Targets Board
                      </h2>
                      <div className="space-y-3">
                        {dashboardData.sharedTasks.map((task) => {
                          const isCreatorSelf = (task.creatorId as any)?._id?.toString() === user?.id || (task.creatorId as any)?.id === user?.id;
                          const partnerProfile = isCreatorSelf ? task.partnerId : task.creatorId;
                          const partnerLabel = (partnerProfile as any)?.name || `@${(partnerProfile as any)?.username || "partner"}`;
                          const partnerInitial = (partnerProfile as any)?.name ? (partnerProfile as any).name[0].toUpperCase() : (partnerProfile as any)?.username?.[0].toUpperCase() || "P";
                          
                          return (
                            <Card key={task.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-zinc-800 transition-all duration-300 border-indigo-950/40 bg-zinc-950/20">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleTaskStatus(task.id)}
                                  className="mt-1 text-zinc-650 hover:text-indigo-400 focus:outline-none shrink-0"
                                >
                                  {task.status === "COMPLETED" ? (
                                    <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                                  ) : task.status === "IN_PROGRESS" ? (
                                    <Clock className="h-5 w-5 text-purple-400" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-zinc-750" />
                                  )}
                                </button>
                                <div className="text-left">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span 
                                      onClick={() => navigate(`/tasks/${task.id}`)}
                                      className={`text-sm font-semibold cursor-pointer hover:text-indigo-400 hover:underline ${task.status === "COMPLETED" ? "line-through text-zinc-550" : "text-zinc-100"}`}
                                    >
                                      {task.title}
                                    </span>
                                    <Badge variant={task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "warning" : "secondary"} className="text-[9px] px-1 py-0">
                                      {task.status.replace("_", " ").toLowerCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-zinc-400 mt-1">{task.description}</p>
                                  
                                  <div className="flex items-center gap-2 mt-3">
                                    <div className="flex -space-x-1">
                                      <div className="h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700 text-[8px] font-bold text-zinc-300 flex items-center justify-center animate-pulse" title="You">
                                        {user?.name ? user.name[0].toUpperCase() : user?.username?.[0].toUpperCase() || "U"}
                                      </div>
                                      <div className="h-5 w-5 rounded-full bg-indigo-950 border border-indigo-900 text-[8px] font-bold text-indigo-450 flex items-center justify-center" title={partnerLabel}>
                                        {partnerInitial}
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-zinc-500">
                                      Partner: <span className="font-semibold text-indigo-400">{partnerLabel}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTask(task.id, task.title)}
                                className="self-end sm:self-auto rounded-lg p-2 text-zinc-700 hover:text-red-400 hover:bg-red-950/20 transition-all focus:outline-none shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* General Space checklist */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase">All Active Space board</h2>
                      <Badge variant="secondary" className="px-2 py-0.5 text-[9px] font-semibold">
                        {tasks.filter(t => t.status !== "COMPLETED").length} Remaining
                      </Badge>
                    </div>

                    {tasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-zinc-900 bg-zinc-950/20">
                        <Clock className="h-10 w-10 text-zinc-700 mb-3" />
                        <p className="text-xs font-semibold text-zinc-400">No tasks currently tracked.</p>
                        <p className="text-[10px] text-zinc-600 mt-1">Create a milestone and assign an accountability buddy to begin.</p>
                        <Button onClick={() => setIsTaskModalOpen(true)} variant="secondary" size="sm" className="mt-4 font-semibold text-xs h-8">
                          Create Milestone
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tasks.map((task) => (
                          <Card key={task.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-zinc-800 transition-all duration-300 relative group overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/[0.01] group-hover:bg-indigo-500/[0.02] blur-xl rounded-full transition-colors pointer-events-none" />
                            
                            <div className="flex items-start gap-3.5">
                              <button
                                onClick={() => handleToggleTaskStatus(task.id)}
                                className="mt-1 flex-shrink-0 text-zinc-500 hover:text-indigo-400 transition-colors focus:outline-none shrink-0"
                              >
                                {task.status === "COMPLETED" ? (
                                  <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                                ) : task.status === "IN_PROGRESS" ? (
                                  <Clock className="h-5 w-5 text-purple-400" />
                                ) : (
                                  <Circle className="h-5 w-5 text-zinc-800" />
                                )}
                              </button>
                              
                              <div className="text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => navigate(`/tasks/${task.id}`)}
                                    className={`text-sm font-semibold tracking-tight text-left hover:text-indigo-400 hover:underline transition-colors focus:outline-none ${task.status === "COMPLETED" ? "line-through text-zinc-550 hover:text-zinc-550" : "text-zinc-100"}`}
                                  >
                                    {task.title}
                                  </button>
                                  
                                  <Badge variant={task.priority === "HIGH" ? "destructive" : task.priority === "MEDIUM" ? "warning" : "secondary"} className="text-[9px] uppercase tracking-wider px-1.5 py-0">
                                    {task.priority.toLowerCase()}
                                  </Badge>
                                </div>
                                
                                <p className="text-xs text-zinc-400/90 mt-1 max-w-lg leading-relaxed">{task.description}</p>
                                
                                <div className="flex items-center gap-4 mt-2.5 text-[10px] text-zinc-500 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" /> Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No target date"}
                                  </span>
                                  <button
                                    onClick={() => navigate(`/tasks/${task.id}`)}
                                    className="flex items-center gap-1 text-[10px] text-indigo-400/80 hover:text-indigo-400 underline font-semibold transition-colors focus:outline-none"
                                  >
                                    <ExternalLink className="h-3 w-3" /> View Target details
                                  </button>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="self-end sm:self-auto rounded-lg p-2 text-zinc-700 hover:text-red-400 hover:bg-red-950/20 transition-all focus:outline-none shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right Block: Collaboration & Activity Panels */}
            <div className="space-y-6">
              {invites.some((invite) => invite.status === "PENDING" && invite.receiverId.id === user?.id) ? (
                <div className="space-y-3 text-left">
                  <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase">Invite Requests</h2>
                  <Card className="p-4 space-y-3 border-indigo-950/40 bg-indigo-950/10">
                    {invites
                      .filter((invite) => invite.status === "PENDING" && invite.receiverId.id === user?.id)
                      .map((invite) => (
                        <div key={invite.id} className="space-y-2 border-b border-indigo-950/40 pb-3 last:border-0 last:pb-0">
                          <p className="text-xs text-zinc-300">
                            <span className="font-semibold">@{invite.senderId.username}</span> invited you to <span className="font-semibold">{invite.taskId.title}</span>.
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-[10px]" onClick={() => handleInviteResponse(invite.id, "accept")}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleInviteResponse(invite.id, "decline")}>
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                  </Card>
                </div>
              ) : null}

              <div className="space-y-3 text-left">
                <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase">Quick Check-in</h2>
                <Card className="p-4 border-zinc-900 bg-zinc-950/30">
                  <form onSubmit={handleQuickCheckIn} className="space-y-3">
                    <select
                      value={checkInTaskId}
                      onChange={(e) => setCheckInTaskId(e.target.value)}
                      className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    >
                      <option value="">Choose a shared task</option>
                      {(dashboardData?.sharedTasks || []).map((task) => (
                        <option key={task.id} value={task.id}>{task.title}</option>
                      ))}
                    </select>
                    <select
                      value={checkInStatus}
                      onChange={(e) => setCheckInStatus(e.target.value as CheckInStatus)}
                      className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    >
                      <option value="COMPLETED">Completed</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="MISSED">Missed</option>
                    </select>
                    <textarea
                      value={checkInNotes}
                      onChange={(e) => setCheckInNotes(e.target.value)}
                      rows={2}
                      className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      placeholder="Optional note"
                    />
                    <Button type="submit" disabled={!checkInTaskId} className="w-full h-8 text-xs font-semibold">
                      Submit Check-in
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Check-in Reminders */}
              {dashboardData?.checkInReminders && dashboardData.checkInReminders.length > 0 && (
                <div className="space-y-3 text-left">
                  <h2 className="text-xs font-bold text-zinc-350 tracking-wide uppercase flex items-center gap-1.5">
                    <Bell className="h-4 w-4 text-amber-500" /> Reminders
                  </h2>
                  <div className="space-y-3">
                    {dashboardData.checkInReminders.map((reminder, idx) => (
                      <Card key={idx} className="p-3 border-amber-900 bg-amber-950/10 hover:bg-amber-950/15 transition-all relative overflow-hidden text-left">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500" />
                        <p className="text-[11px] text-zinc-300 font-medium leading-relaxed">
                          Update <span className="text-amber-450 font-semibold">{reminder.partnerName}</span> on progress for <span className="font-semibold text-zinc-200">"{reminder.taskTitle}"</span>.
                        </p>
                        <Button
                          onClick={() => setCheckInTaskId(reminder.taskId)}
                          variant="outline" 
                          className="w-full text-[10px] font-bold h-7 mt-2 border-amber-950/40 hover:bg-amber-950/20 text-amber-450 hover:text-amber-300"
                        >
                          Fill Check-in
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Accountability Partners Box */}
              <div className="space-y-3 text-left">
                <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase">Accountability Partners</h2>
                <Card className="p-4 space-y-3.5 border-zinc-900 bg-zinc-950/30">
                  {buddies.length === 0 ? (
                    <p className="text-[10px] text-zinc-600 italic text-center py-2">No partners linked yet.</p>
                  ) : (
                    buddies.map((buddy) => (
                      <div key={buddy.id} className="flex items-center justify-between gap-2 border-b border-zinc-900/50 pb-2.5 last:border-0 last:pb-0">
                        <button
                          onClick={() => navigate(`/profile/${buddy.username}`)}
                          className="flex items-center gap-2 text-left hover:opacity-85 transition-all focus:outline-none group shrink-0"
                        >
                          <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-center group-hover:border-indigo-500/30 transition-all">
                            {buddy.name[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-400 transition-colors">{buddy.name}</span>
                            <span className="text-[10px] text-zinc-500">@{buddy.username}</span>
                          </div>
                        </button>
                        <Badge 
                          variant={buddy.status === "active" ? "success" : "warning"}
                          className="text-[9px] px-1.5 py-0 uppercase shrink-0"
                        >
                          {buddy.status}
                        </Badge>
                      </div>
                    ))
                  )}
                  <Button onClick={() => setIsBuddyModalOpen(true)} variant="outline" className="w-full text-xs font-semibold h-8 mt-2">
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> Link new partner
                  </Button>
                </Card>
              </div>

              {/* Recent Activity Log */}
              <div className="space-y-3 text-left">
                <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase">Recent Activity Feed</h2>
                <Card className="p-4 space-y-3.5 border-zinc-900 bg-zinc-950/30 max-h-80 overflow-y-auto">
                  {dashboardData?.activities && dashboardData.activities.length > 0 ? (
                    dashboardData.activities.map((act) => (
                      <div key={act.id} className="flex items-start gap-2.5 text-[11px] border-l-2 border-zinc-900 pl-3 py-0.5 text-left">
                        <div className="flex-1">
                          <p className="text-zinc-350 leading-relaxed">{act.text}</p>
                          <span className="text-[9px] text-zinc-500 mt-1 block">{act.time}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic text-center py-2">No recent activity detected.</p>
                  )}
                </Card>
              </div>
            </div>
          </div>

          {/* Modal Overlay: Create Task */}
          <Modal
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            title="Create Accountability Task"
          >
            <form onSubmit={handleCreateTask} className="space-y-4">
              <Input
                id="taskTitle"
                label="Task Title"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Implement Prisma migrations"
              />
              <Input
                id="taskDesc"
                label="Description"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Details about what your partner should inspect..."
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <Input
                  id="taskDueDate"
                  label="Target Date"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsTaskModalOpen(false)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Create Task
                </Button>
              </div>
            </form>
          </Modal>

          {/* Modal Overlay: Link/Search Partner */}
          <Modal
            isOpen={isBuddyModalOpen}
            onClose={() => {
              setIsBuddyModalOpen(false);
              setBuddySearchQuery("");
              setInviteTaskId("");
              setInviteFeedback(null);
              setInviteError(null);
            }}
            title="Link Accountability Partner"
          >
            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">Task to share</label>
                <select
                  value={inviteTaskId}
                  onChange={(e) => {
                    setInviteTaskId(e.target.value);
                    setInviteError(null);
                    setInviteFeedback(null);
                  }}
                  className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                >
                  <option value="">Choose a task</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </div>
              <Input
                id="buddySearch"
                label="Search for users"
                value={buddySearchQuery}
                onChange={(e) => setBuddySearchQuery(e.target.value)}
                placeholder="Type username or email..."
                autoFocus
              />

              {inviteError ? <p className="text-xs text-red-400">{inviteError}</p> : null}
              {inviteFeedback ? <p className="text-xs text-emerald-400">{inviteFeedback}</p> : null}

              <div className="space-y-2.5 max-h-60 overflow-y-auto text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-550 block">Search Results</label>
                {searchingProfiles ? (
                  <p className="text-xs text-zinc-500 italic">Searching profiles...</p>
                ) : buddySearchQuery.trim() === "" ? (
                  <p className="text-[10px] text-zinc-600 italic">Enter a name, username, or email to start linking partners.</p>
                ) : searchedProfiles.length === 0 ? (
                  <p className="text-xs text-zinc-550 italic">No matching users found.</p>
                ) : (
                  searchedProfiles.map((profile) => {
                    const existingInvite = invites.find((invite) => {
                      const sameUser = invite.receiverId.id === profile.id || invite.senderId.id === profile.id;
                      const sameTask = (invite.taskId as any).id === inviteTaskId || (invite.taskId as any)._id === inviteTaskId;
                      return sameUser && sameTask && ["PENDING", "ACCEPTED"].includes(invite.status);
                    });
                    const isAlreadyBuddy = buddies.some(b => b.id === profile.id && b.status === "active");
                    return (
                      <div key={profile.id} className="flex items-center justify-between gap-3 border-b border-zinc-900/60 pb-2.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-center">
                            {profile.name ? profile.name[0].toUpperCase() : profile.username[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-zinc-200">{profile.name || profile.username}</span>
                            <span className="text-[10px] text-zinc-550">@{profile.username}</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={submittingInvite || isAlreadyBuddy || !!existingInvite}
                          onClick={() => handleSendInvite(profile)}
                          className="h-7 text-[10px] px-3 font-semibold"
                        >
                          {isAlreadyBuddy ? "Collaborator" : existingInvite ? existingInvite.status.toLowerCase() : "Send Invite"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-end pt-2 border-t border-zinc-900">
                <Button type="button" variant="outline" onClick={() => { setIsBuddyModalOpen(false); setBuddySearchQuery(""); setInviteTaskId(""); setInviteFeedback(null); setInviteError(null); }} size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      ) : (
        /* TAB: Profile tab */
        <div className="space-y-8 max-w-3xl mx-auto">
          {/* User Details Grid */}
          <Card className="p-6 border-zinc-900 bg-zinc-950/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              <div className="h-20 w-20 rounded-xl bg-zinc-900 border border-zinc-800 text-3xl font-extrabold text-indigo-400 flex items-center justify-center shadow-lg shadow-black/40 shrink-0">
                {user?.name ? user.name[0].toUpperCase() : user?.username[0].toUpperCase()}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-100 tracking-tight">{user?.name || "Active Creator"}</h1>
                    <p className="text-xs text-zinc-500">@{user?.username || "creator"}</p>
                  </div>
                  <Button onClick={() => { setEditBioText(profileBio); setIsEditProfileModalOpen(true); }} variant="outline" size="sm" className="h-8 font-semibold text-xs">
                    Edit Bio
                  </Button>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed pt-2">{profileBio}</p>
              </div>
            </div>
          </Card>

          {/* Profile statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 border-zinc-900 bg-zinc-950/40 text-center">
              <Award className="mx-auto h-5 w-5 text-indigo-400 mb-2" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Consistency Rank</span>
              <span className="text-lg font-bold text-zinc-100 mt-1 block">Elite Partner</span>
            </Card>
            <Card className="p-4 border-zinc-900 bg-zinc-950/40 text-center">
              <Flame className="mx-auto h-5 w-5 text-amber-500 mb-2" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Streak Record</span>
              <span className="text-lg font-bold text-zinc-100 mt-1 block">14 days</span>
            </Card>
            <Card className="p-4 border-zinc-900 bg-zinc-950/40 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400 mb-2" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Completed Targets</span>
              <span className="text-lg font-bold text-zinc-100 mt-1 block">{stats.completedTasks} tasks</span>
            </Card>
          </div>

          {/* Modal Overlay: Edit Profile Bio */}
          <Modal
            isOpen={isEditProfileModalOpen}
            onClose={() => setIsEditProfileModalOpen(false)}
            title="Edit Profile Bio"
          >
            <form onSubmit={handleSaveBio} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Short Bio</label>
                <textarea
                  value={editBioText}
                  onChange={(e) => setEditBioText(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="Describe your accountabilty goals..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditProfileModalOpen(false)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Bio
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </AppLayout>
  );
}
