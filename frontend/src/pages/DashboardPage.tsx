import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  AlertTriangle, Bell, BarChart3, Lock, Unlock, Folder,
  Users, Search, RefreshCcw, Edit3, Trash, HelpCircle
} from "lucide-react";
import { cn } from "../utils";
import { taskService } from "../services/taskService";
import type { Task, DashboardData } from "../services/taskService";
import { inviteService } from "../services/inviteService";
import type { Invite } from "../services/inviteService";
import { checkInService } from "../services/checkInService";
import type { CheckInStatus } from "../services/checkInService";
import { analyticsService } from "../services/analyticsService";
import type { AnalyticsData } from "../services/analyticsService";
import { workspaceService } from "../services/workspaceService";
import type { Workspace } from "../services/workspaceService";
import { partnersService } from "../services/partnersService";
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
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState(() => {
    return (location.state as any)?.activeTab || "dashboard";
  });

  React.useEffect(() => {
    if (location.state && (location.state as any).activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);

  const [analyticsRange, setAnalyticsRange] = React.useState<"weekly" | "monthly">("weekly");

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

  // Workspaces State
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState<string>("all");
  const [newTaskWorkspaceId, setNewTaskWorkspaceId] = React.useState<string>("");
  const [newTaskIsPrivate, setNewTaskIsPrivate] = React.useState<boolean>(false);
  const [workspaceNameInput, setWorkspaceNameInput] = React.useState("");
  const [editingWorkspaceId, setEditingWorkspaceId] = React.useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = React.useState("");

  // Accountability Partners State (Relations)
  const [partnerRelations, setPartnerRelations] = React.useState<any[]>([]);
  const [partnerSearchQuery, setPartnerSearchQuery] = React.useState("");
  const [searchedPartnerProfiles, setSearchedPartnerProfiles] = React.useState<any[]>([]);
  const [searchingPartners, setSearchingPartners] = React.useState(false);
  const [partnerFeedback, setPartnerFeedback] = React.useState<string | null>(null);
  const [partnerError, setPartnerError] = React.useState<string | null>(null);
  const [invitePartnerMode, setInvitePartnerMode] = React.useState<"MUTUAL" | "SINGLE">("MUTUAL");

  // Buddy Search state
  const [buddySearchQuery, setBuddySearchQuery] = React.useState("");
  const [searchedProfiles, setSearchedProfiles] = React.useState<any[]>([]);
  const [searchingProfiles, setSearchingProfiles] = React.useState(false);

  const [editBioText, setEditBioText] = React.useState(profileBio);

  // Load Dashboard Data & Tasks
  const loadDashboardData = React.useCallback(async (background = false) => {
    try {
      if (!background) setLoadingDashboard(true);
      const data = await taskService.getDashboardData();
      setDashboardData(data);
      setTasks(data.allTasks || []);
      const [inviteList, analyticsData, workspacesList, partnersList] = await Promise.all([
        inviteService.listInvites(),
        analyticsService.getAnalytics(analyticsRange),
        workspaceService.getWorkspaces(),
        partnersService.getPartners()
      ]);
      setInvites(inviteList);
      setAnalytics(analyticsData);
      setWorkspaces(workspacesList);
      setPartnerRelations(partnersList);
    } catch (error) {
      console.error("Failed to load dashboard data from API:", error);
    } finally {
      if (!background) setLoadingDashboard(false);
    }
  }, [analyticsRange]);

  React.useEffect(() => {
    loadDashboardData();
    
    const interval = setInterval(() => {
      loadDashboardData(true); // background load every 5 seconds
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadDashboardData, analyticsRange]);

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

  // Reset check-in status to IN_PROGRESS if a partner's task is selected and status is COMPLETED
  React.useEffect(() => {
    if (checkInTaskId) {
      const selectedTask = (dashboardData?.sharedTasks || []).find(t => t.id === checkInTaskId) || tasks.find(t => t.id === checkInTaskId);
      if (selectedTask) {
        const isCreator = (selectedTask.creatorId as any)?.id === user?.id || selectedTask.creatorId === user?.id;
        if (!isCreator && checkInStatus === "COMPLETED") {
          setCheckInStatus("IN_PROGRESS");
        }
      }
    }
  }, [checkInTaskId, dashboardData?.sharedTasks, tasks, checkInStatus, user?.id]);

  const buddies = React.useMemo<Buddy[]>(() => {
    const partnerMap = new Map<string, Buddy>();
    
    partnerRelations.forEach((rel) => {
      const partnerUser = (rel.senderId?.id === user?.id || rel.senderId === user?.id) ? rel.receiverId : rel.senderId;
      if (!partnerUser || !partnerUser.id) return;
      partnerMap.set(partnerUser.id, {
        id: partnerUser.id,
        name: partnerUser.name || partnerUser.username,
        username: partnerUser.username,
        status: rel.status === "ACCEPTED" ? "active" : "pending",
      });
    });

    return Array.from(partnerMap.values());
  }, [partnerRelations, user?.id]);

  // Computed filtered tasks lists based on workspaceId filter
  const filteredTasks = React.useMemo(() => {
    if (selectedWorkspaceId === "all") {
      return tasks;
    }
    if (selectedWorkspaceId === "none") {
      return tasks.filter(t => !t.workspaceId);
    }
    return tasks.filter(t => t.workspaceId === selectedWorkspaceId);
  }, [tasks, selectedWorkspaceId]);

  const filteredSharedTasks = React.useMemo(() => {
    if (!dashboardData?.sharedTasks) return [];
    if (selectedWorkspaceId === "all") {
      return dashboardData.sharedTasks;
    }
    if (selectedWorkspaceId === "none") {
      return dashboardData.sharedTasks.filter(t => !t.workspaceId);
    }
    return dashboardData.sharedTasks.filter(t => t.workspaceId === selectedWorkspaceId);
  }, [dashboardData?.sharedTasks, selectedWorkspaceId]);

  const filteredOverdueTasks = React.useMemo(() => {
    if (!dashboardData?.overdueTasks) return [];
    if (selectedWorkspaceId === "all") {
      return dashboardData.overdueTasks;
    }
    if (selectedWorkspaceId === "none") {
      return dashboardData.overdueTasks.filter(t => !t.workspaceId);
    }
    return dashboardData.overdueTasks.filter(t => t.workspaceId === selectedWorkspaceId);
  }, [dashboardData?.overdueTasks, selectedWorkspaceId]);

  // Actions
  const getMinDateTimeString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (newTaskDueDate) {
      const selected = new Date(newTaskDueDate);
      if (selected <= new Date()) {
        alert("Target due date must be in the future!");
        return;
      }
    }

    try {
      await taskService.createTask({
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority.toUpperCase() as any,
        dueDate: newTaskDueDate || null,
        isPrivate: newTaskIsPrivate,
        workspaceId: newTaskWorkspaceId || null,
      });

      await loadDashboardData();
      
      // Reset Form & Close
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
      setNewTaskDueDate("");
      setNewTaskIsPrivate(false);
      setNewTaskWorkspaceId("");
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

  // Workspace Actions
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceNameInput.trim()) return;
    try {
      await workspaceService.createWorkspace(workspaceNameInput);
      setWorkspaceNameInput("");
      const workspacesList = await workspaceService.getWorkspaces();
      setWorkspaces(workspacesList);
    } catch (error) {
      console.error("Failed to create workspace:", error);
    }
  };

  const handleUpdateWorkspaceName = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await workspaceService.updateWorkspace(id, newName);
      setEditingWorkspaceId(null);
      const workspacesList = await workspaceService.getWorkspaces();
      setWorkspaces(workspacesList);
    } catch (error) {
      console.error("Failed to update workspace:", error);
    }
  };

  const handleDeleteWorkspace = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workspace? Tasks will not be deleted, but they will be moved to 'Inbox'.")) return;
    try {
      await workspaceService.deleteWorkspace(id);
      if (selectedWorkspaceId === id) {
        setSelectedWorkspaceId("all");
      }
      const workspacesList = await workspaceService.getWorkspaces();
      setWorkspaces(workspacesList);
      await loadDashboardData(true);
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    }
  };

  const handleRestoreDefaultWorkspaces = async () => {
    try {
      const data = await workspaceService.restoreDefaultWorkspaces();
      setWorkspaces(data);
      alert("Default workspaces (Personal & Work) restored successfully.");
    } catch (error) {
      console.error("Failed to restore defaults:", error);
    }
  };

  // Partners search & management Actions
  const handlePartnerSearch = async (query: string) => {
    setPartnerSearchQuery(query);
    if (!query.trim()) {
      setSearchedPartnerProfiles([]);
      return;
    }
    try {
      setSearchingPartners(true);
      const response = await api.get(`/profiles?query=${encodeURIComponent(query)}`);
      setSearchedPartnerProfiles(response.data.profiles || []);
    } catch (error) {
      console.error("Failed to search partners:", error);
    } finally {
      setSearchingPartners(false);
    }
  };

  const handleAddAccountabilityPartner = async (profile: any) => {
    try {
      setPartnerError(null);
      setPartnerFeedback(null);
      await partnersService.invitePartner(profile.username, invitePartnerMode);
      setPartnerFeedback(`Partner invitation sent to @${profile.username}!`);
      const data = await partnersService.getPartners();
      setPartnerRelations(data);
    } catch (error: any) {
      setPartnerError(error.response?.data?.message || "Could not send partner invitation.");
    }
  };

  const handleAcceptPartnerInvite = async (relationId: string) => {
    try {
      setPartnerError(null);
      setPartnerFeedback(null);
      await partnersService.acceptPartnerInvite(relationId);
      setPartnerFeedback("Partner invitation accepted!");
      await loadDashboardData();
    } catch (error: any) {
      setPartnerError(error.response?.data?.message || "Could not accept partner invitation.");
    }
  };

  const handleDeclinePartnerInvite = async (relationId: string) => {
    try {
      setPartnerError(null);
      setPartnerFeedback(null);
      await partnersService.declinePartnerInvite(relationId);
      setPartnerFeedback("Partner invitation declined.");
      await loadDashboardData();
    } catch (error: any) {
      setPartnerError(error.response?.data?.message || "Could not decline partner invitation.");
    }
  };

  const handleRemoveAccountabilityPartner = async (relationId: string) => {
    if (!confirm("Remove this user as an accountability partner? This will revoke task monitoring and workspace sharing.")) return;
    try {
      await partnersService.removePartner(relationId);
      const data = await partnersService.getPartners();
      setPartnerRelations(data);
      await loadDashboardData(true);
    } catch (error) {
      console.error("Failed to remove partner:", error);
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
    const timeStr = new Date(dueDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`;
    } else if (diffDays === 0) {
      return `Due Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Due Tomorrow at ${timeStr}`;
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days (${timeStr})`;
    } else {
      return `Due on ${new Date(dueDate).toLocaleDateString()} at ${timeStr}`;
    }
  };

  // TAB: Partners tab render
  const renderPartnersTab = () => {
    // Separate relationships
    const acceptedMutual = partnerRelations.filter(
      (r) => r.status === "ACCEPTED" && r.mode === "MUTUAL"
    );
    const acceptedSingle = partnerRelations.filter(
      (r) => r.status === "ACCEPTED" && r.mode === "SINGLE" && (r.senderId.id === user?.id || r.senderId === user?.id)
    );
    const incomingPending = partnerRelations.filter(
      (r) => r.status === "PENDING" && (r.receiverId.id === user?.id || r.receiverId === user?.id)
    );


    const isMutualLimitReached = acceptedMutual.length >= 3;
    const isSingleLimitReached = acceptedSingle.length >= 4;

    const explainMode = (mode: "MUTUAL" | "SINGLE") => {
      if (mode === "MUTUAL") {
        return "Mutual partner means you both monitor each other's tasks and are added to each other's workspaces.";
      }
      return "Single partner means they monitor your tasks (read-only for them, they do not share their tasks or workspaces with you).";
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto text-left animate-fade-in">
        {/* Header Block */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Accountability Partners
          </h1>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            Manage your accountability partner network. Invite others as Mutual or Single partners and track task alignments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Block: Manage / Add Partners */}
          <div className="md:col-span-1 space-y-5">
            <Card className="p-5 border-zinc-900 bg-zinc-950/20 shadow-md">
              <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase mb-3.5 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-indigo-400" /> Link Partner
              </h3>
              
              <div className="space-y-4">
                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Partner Mode</label>
                  <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-900">
                    <button
                      type="button"
                      onClick={() => setInvitePartnerMode("MUTUAL")}
                      className={cn(
                        "py-1.5 text-[10px] font-bold rounded transition-all",
                        invitePartnerMode === "MUTUAL" ? "bg-zinc-900 text-indigo-400" : "text-zinc-550 hover:text-zinc-350"
                      )}
                    >
                      Mutual ({acceptedMutual.length}/3)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvitePartnerMode("SINGLE")}
                      className={cn(
                        "py-1.5 text-[10px] font-bold rounded transition-all",
                        invitePartnerMode === "SINGLE" ? "bg-zinc-900 text-indigo-400" : "text-zinc-550 hover:text-zinc-350"
                      )}
                    >
                      Single ({acceptedSingle.length}/4)
                    </button>
                  </div>
                </div>

                {/* Explanation Tooltip Box */}
                <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-900 text-[10px] text-zinc-400 space-y-1 relative">
                  <div className="flex items-center gap-1 font-bold text-zinc-300">
                    <HelpCircle className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>Mode Explanation:</span>
                  </div>
                  <p className="leading-normal">{explainMode(invitePartnerMode)}</p>
                </div>

                {/* Warning Banner if limit exceeded */}
                {((invitePartnerMode === "MUTUAL" && isMutualLimitReached) ||
                  (invitePartnerMode === "SINGLE" && isSingleLimitReached)) && (
                  <div className="p-3 rounded-lg border border-red-950 bg-red-950/20 text-red-400 text-[10px] leading-normal font-semibold">
                    You've exceeded the partner limit. Remove a dormant partner to add another.
                  </div>
                )}

                <div className="relative">
                  <Input
                    id="partnerSearchInput"
                    placeholder="Search by username..."
                    disabled={(invitePartnerMode === "MUTUAL" && isMutualLimitReached) || (invitePartnerMode === "SINGLE" && isSingleLimitReached)}
                    value={partnerSearchQuery}
                    onChange={(e) => handlePartnerSearch(e.target.value)}
                    className="pl-8"
                  />
                  <Search className="absolute left-2.5 top-3 h-4 w-4 text-zinc-500 pointer-events-none" />
                </div>

                {/* Feedback Alerts */}
                {partnerFeedback && (
                  <div className="p-2.5 rounded-lg border border-emerald-900 bg-emerald-950/20 text-emerald-400 text-[10px] font-semibold">
                    {partnerFeedback}
                  </div>
                )}
                {partnerError && (
                  <div className="p-2.5 rounded-lg border border-red-950 bg-red-950/20 text-red-400 text-[10px] font-semibold">
                    {partnerError}
                  </div>
                )}

                {/* Searched Profiles List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {searchingPartners ? (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  ) : partnerSearchQuery && searchedPartnerProfiles.length === 0 ? (
                    <p className="text-[10px] text-zinc-550 italic text-center py-4">No users found.</p>
                  ) : (
                    searchedPartnerProfiles.map((profile) => {
                      const isAlreadyLinked = partnerRelations.some(
                        (rel) =>
                          (rel.senderId.id === profile.id || rel.receiverId.id === profile.id) &&
                          rel.status === "ACCEPTED"
                      );
                      const hasPending = partnerRelations.some(
                        (rel) =>
                          (rel.senderId.id === profile.id || rel.receiverId.id === profile.id) &&
                          rel.status === "PENDING"
                      );

                      const isDisabled = 
                        isAlreadyLinked || 
                        hasPending ||
                        (invitePartnerMode === "MUTUAL" && isMutualLimitReached) ||
                        (invitePartnerMode === "SINGLE" && isSingleLimitReached);

                      return (
                        <div key={profile.id} className="flex items-center justify-between gap-3 border-b border-zinc-900/60 pb-2.5 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300 flex items-center justify-center">
                              {profile.name ? profile.name[0].toUpperCase() : profile.username[0].toUpperCase()}
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-semibold text-zinc-200">{profile.name || profile.username}</span>
                              <span className="text-[9px] text-zinc-500">@{profile.username}</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isDisabled}
                            onClick={() => handleAddAccountabilityPartner(profile)}
                            className="h-6.5 text-[9px] px-2.5 font-semibold"
                          >
                            {isAlreadyLinked ? "Linked" : hasPending ? "Pending" : "Invite"}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Right Block: Current Partners List & Pending Invitations */}
          <div className="md:col-span-2 space-y-6">
            {/* Pending partner invitations block */}
            {incomingPending.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-amber-450 tracking-wider uppercase flex items-center gap-1.5">
                  <Bell className="h-4 w-4 animate-pulse animate-duration-1000" /> Pending Partner Invitations ({incomingPending.length})
                </h3>
                <div className="space-y-3">
                  {incomingPending.map((invite) => {
                    const sender = invite.senderId;
                    const isMutualInvite = invite.mode === "MUTUAL";
                    const isAcceptDisabled = isMutualInvite ? isMutualLimitReached : isSingleLimitReached;

                    return (
                      <Card key={invite.id} className="p-4 border-indigo-950 bg-indigo-950/10 flex flex-col gap-3 relative text-left">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-bold text-zinc-300 flex items-center justify-center">
                              {sender.name ? sender.name[0].toUpperCase() : sender.username[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-zinc-200">{sender.name || sender.username}</span>
                              <span className="text-[9px] text-zinc-500 block">@{sender.username}</span>
                              <span className="text-[10px] font-bold text-indigo-400 block mt-0.5">
                                Invited you to be a {isMutualInvite ? "Mutual" : "Single"} Partner
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 shrink-0">
                            <Button 
                              size="sm" 
                              onClick={() => handleAcceptPartnerInvite(invite.id)} 
                              disabled={isAcceptDisabled}
                              className="h-7 text-[10px] px-2.5 font-bold"
                            >
                              Accept
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleDeclinePartnerInvite(invite.id)}
                              className="h-7 text-[10px] px-2.5 font-semibold"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>

                        {/* Invite explanation box */}
                        <div className="text-[9px] text-zinc-500 bg-zinc-950/40 p-2.5 rounded border border-zinc-900/60 leading-normal">
                          <span className="font-semibold text-zinc-400 block mb-0.5">Invitation details:</span>
                          {explainMode(invite.mode)}
                          {isAcceptDisabled && (
                            <span className="text-red-400 font-bold block mt-1.5">
                              ⚠️ You cannot accept this invitation because you have reached your partner limit. Remove a dormant partner to accept.
                            </span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Current Active Partners lists */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase flex items-center gap-1.5">
                <Users className="h-4 w-4 text-indigo-400" /> Active Partners ({acceptedMutual.length + acceptedSingle.length})
              </h3>

              {partnerRelations.filter(r => r.status === "ACCEPTED").length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center rounded-xl border border-zinc-900 bg-zinc-950/20">
                  <Users className="h-10 w-10 text-zinc-700 mb-3" />
                  <p className="text-xs font-semibold text-zinc-400">No accountability partners linked yet.</p>
                  <p className="text-[10px] text-zinc-650 mt-1">Use the search utility to invite a partner and start sharing goals.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {partnerRelations
                    .filter((r) => r.status === "ACCEPTED")
                    .map((relation) => {
                      const partner = (relation.senderId.id === user?.id || relation.senderId === user?.id) ? relation.receiverId : relation.senderId;
                      const isMutual = relation.mode === "MUTUAL";
                      
                      // Calculate shared workspaces
                      const sharedWorkspaces = workspaces.filter(w => {
                        const wUserId = typeof w.userId === 'string' ? w.userId : w.userId?.id;
                        const isOwner = wUserId === user?.id;
                        const isPartnerOwner = wUserId === partner.id;
                        const isPartnerInCollaborators = (w.collaboratorIds || []).some((cid: any) => cid.id === partner.id || cid === partner.id);
                        const isUserInCollaborators = (w.collaboratorIds || []).some((cid: any) => cid.id === user?.id || cid === user?.id);
                        return (isOwner && isPartnerInCollaborators) || (isPartnerOwner && isUserInCollaborators);
                      });

                      // Calculate shared tasks
                      const sharedTasks = [
                        ...tasks,
                        ...(dashboardData?.sharedTasks || [])
                      ].filter((t, idx, self) => 
                        self.findIndex(x => x.id === t.id) === idx
                      ).filter(t => {
                        const tCreatorId = typeof t.creatorId === 'string' ? t.creatorId : t.creatorId?.id;
                        const isOwner = tCreatorId === user?.id;
                        const isPartnerOwner = tCreatorId === partner.id;

                        const tPartnerIdStr = typeof t.partnerId === 'string' ? t.partnerId : t.partnerId?.id;
                        const isPartnerCollaborator = (t.collaboratorIds || []).some(cid => cid.id === partner.id) || tPartnerIdStr === partner.id;
                        const isUserCollaborator = (t.collaboratorIds || []).some(cid => cid.id === user?.id) || tPartnerIdStr === user?.id;

                        return (isOwner && isPartnerCollaborator) || (isPartnerOwner && isUserCollaborator);
                      });

                      return (
                        <Card key={relation.id} className="p-4 flex flex-col justify-between border-zinc-900 bg-zinc-950/30 relative group overflow-hidden hover:border-zinc-800 transition-all duration-350">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/[0.01] blur-xl rounded-full pointer-events-none" />
                          
                          <div className="flex items-start justify-between gap-3 text-left">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-bold text-zinc-300 flex items-center justify-center">
                                {partner.name ? partner.name[0].toUpperCase() : partner.username[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="text-xs font-bold text-zinc-200">{partner.name || partner.username}</span>
                                <span className="text-[10px] text-zinc-500">@{partner.username}</span>
                              </div>
                            </div>
                            <Badge 
                              variant={isMutual ? "success" : "secondary"} 
                              className={cn("text-[8px] px-1.5 py-0 uppercase tracking-wide", isMutual ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/30" : "bg-zinc-900 text-zinc-450")}
                            >
                              {relation.mode} Partner
                            </Badge>
                          </div>

                          <div className="text-[9px] text-zinc-500 mt-3 bg-zinc-950/20 p-2 rounded border border-zinc-900/40 text-left">
                            {isMutual 
                              ? "✓ You monitor each other & share workspaces"
                              : `✓ ${partner.username} monitors your tasks`}
                          </div>

                          {/* Shared Workspaces */}
                          <div className="mt-3.5 space-y-2 text-left">
                            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Shared Workspaces</span>
                            {sharedWorkspaces.length === 0 ? (
                              <p className="text-[9px] text-zinc-650 italic pl-1">No shared workspaces.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 pl-1">
                                {sharedWorkspaces.map(w => {
                                  const isOwner = (w.userId as any)?.id === user?.id || w.userId === user?.id;
                                  return (
                                    <div key={w.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-950/40 border border-zinc-900 text-[9px] text-zinc-300 font-semibold">
                                      <span>{w.name}</span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const msg = isOwner 
                                            ? `Remove @${partner.username} from workspace "${w.name}"?` 
                                            : `Leave workspace "${w.name}" owned by @${partner.username}?`;
                                          if (confirm(msg)) {
                                            try {
                                              const targetUserId = isOwner ? partner.id : user?.id;
                                              if (targetUserId) {
                                                await workspaceService.removePartnerFromWorkspace(w.id, targetUserId);
                                                await loadDashboardData();
                                              }
                                            } catch (err) {
                                              console.error("Failed to remove partner from workspace:", err);
                                            }
                                          }
                                        }}
                                        className="text-red-400 hover:text-red-300 font-bold pl-1 ml-1 border-l border-zinc-850 focus:outline-none"
                                        title="Remove link"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Shared Tasks */}
                          <div className="mt-3 space-y-2 text-left">
                            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Shared Tasks</span>
                            {sharedTasks.length === 0 ? (
                              <p className="text-[9px] text-zinc-650 italic pl-1">No shared tasks.</p>
                            ) : (
                              <div className="space-y-1 pl-1 max-h-36 overflow-y-auto pr-1">
                                {sharedTasks.map(t => {
                                  const isOwner = (t.creatorId as any)?.id === user?.id || t.creatorId === user?.id;
                                  return (
                                    <div key={t.id} className="flex items-center justify-between p-1.5 rounded bg-zinc-950/40 border border-zinc-900/60 hover:border-zinc-800 transition-all gap-2 text-[9px]">
                                      <span className="text-zinc-350 font-semibold truncate flex-1">{t.title}</span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const msg = isOwner 
                                            ? `Remove @${partner.username} from task "${t.title}"?` 
                                            : `Remove yourself from task "${t.title}" created by @${(t.creatorId as any)?.username || 'partner'}?`;
                                          if (confirm(msg)) {
                                            try {
                                              const targetUserId = isOwner ? partner.id : user?.id;
                                              if (targetUserId) {
                                                await taskService.removeCollaboratorFromTask(t.id, targetUserId);
                                                await loadDashboardData();
                                              }
                                            } catch (err) {
                                              console.error("Failed to remove collaborator from task:", err);
                                            }
                                          }
                                        }}
                                        className="text-red-400 hover:text-red-300 font-bold focus:outline-none px-1 rounded hover:bg-red-950/20"
                                        title="Remove link"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 mt-4">
                            <span className="text-[9px] font-semibold text-indigo-400">Added to all public tasks</span>
                            <button
                              onClick={() => handleRemoveAccountabilityPartner(relation.id)}
                              className="text-[10px] text-red-400 hover:text-red-300 font-semibold flex items-center gap-0.5 focus:outline-none transition-colors"
                            >
                              <Trash2 className="h-3 w-3" /> Remove Partner
                            </button>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // TAB: Analytics tab render
  const renderAnalyticsTab = () => {
    if (!analytics) return (
      <div className="space-y-4 text-left">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );

    const metrics = analytics.metrics;
    
    // Sort activity by day to display chronologically in the chart
    const chartData = Object.entries(analytics.activityByDay || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7); // Last 7 entries

    const maxActivityCount = chartData.length > 0 ? Math.max(...chartData.map(d => d[1]), 1) : 1;

    return (
      <div className="space-y-8 animate-fade-in text-left">
        {/* Header and Toggle Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Performance Analytics</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Analyze your workspaces completion velocity and partner accountability sync ratings.
            </p>
          </div>
          <div className="flex border border-zinc-900 bg-zinc-950/80 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setAnalyticsRange("weekly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${analyticsRange === "weekly" ? "bg-zinc-900 text-zinc-50 shadow-sm border border-zinc-800" : "text-zinc-550 hover:text-zinc-350"}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setAnalyticsRange("monthly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${analyticsRange === "monthly" ? "bg-zinc-900 text-zinc-50 shadow-sm border border-zinc-800" : "text-zinc-550 hover:text-zinc-350"}`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 bg-zinc-950/40 border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Task Completion Velocity</span>
            <div className="flex items-baseline gap-1 mt-2.5">
              <span className="text-3xl font-extrabold text-zinc-100">{metrics.completionRate}%</span>
              <span className="text-xs text-zinc-500 font-semibold">rate</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">{metrics.completedTasks} of {metrics.totalTasks} targets checked off</p>
          </Card>

          <Card className="p-5 bg-zinc-950/40 border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Check-in Consistency</span>
            <div className="flex items-baseline gap-1 mt-2.5">
              <span className="text-3xl font-extrabold text-indigo-400">{metrics.checkInConsistency}%</span>
              <span className="text-xs text-zinc-500 font-semibold">score</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">Based on {metrics.totalCheckIns} submitted updates</p>
          </Card>

          <Card className="p-5 bg-zinc-950/40 border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Mutual / Single Partners</span>
            <div className="flex items-baseline gap-1 mt-2.5">
              <span className="text-3xl font-extrabold text-purple-400">
                {(metrics as any).mutualPartnersCount || 0} / {(metrics as any).singlePartnersCount || 0}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">Maximum allowed is 3 mutual, 4 single</p>
          </Card>

          <Card className="p-5 bg-zinc-950/40 border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Consistency Rank</span>
            <div className="flex items-baseline gap-1 mt-2.5">
              <span className="text-lg font-bold text-emerald-400">{metrics.completionRate >= 80 ? "Elite Partner" : metrics.completionRate >= 50 ? "Active Partner" : "Growing Partner"}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3">Recalculates based on target velocity</p>
          </Card>
        </div>

        {/* Workspaces Performance & Partners Performance section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workspaces breakdown table */}
          <Card className="p-6 border-zinc-900 bg-zinc-950/40 space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-200">Workspaces Performance</h3>
              <p className="text-[11px] text-zinc-550">Overview of active task completion rates per workspace.</p>
            </div>
            
            <div className="space-y-4 overflow-y-auto max-h-60 pt-2 flex-1">
              {((analytics as any).workspaces || []).length === 0 ? (
                <p className="text-[11px] text-zinc-600 italic text-center py-8">No workspaces loaded.</p>
              ) : (
                ((analytics as any).workspaces as any[]).map((ws) => (
                  <div key={ws.workspaceId} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-350">
                      <span className="truncate flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        {ws.name}
                        {ws.owner?.id !== user?.id && ws.owner?.id !== undefined && (
                          <span className="text-[8px] px-1 py-0 rounded bg-indigo-950 border border-indigo-900/60 text-indigo-400 font-bold">
                            @{ws.owner?.username}
                          </span>
                        )}
                      </span>
                      <span>
                        {ws.completionRate}% ({ws.completedTasks}/{ws.totalTasks})
                        {ws.overdueTasks > 0 && (
                          <span className="text-red-400 ml-1.5 font-bold">({ws.overdueTasks} Overdue)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-300", 
                          ws.overdueTasks > 0 ? "bg-red-500" : "bg-gradient-to-r from-indigo-500 to-cyan-400"
                        )} 
                        style={{ width: `${ws.completionRate}%` }} 
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Partner Consistency Alignment table */}
          <Card className="p-6 border-zinc-900 bg-zinc-950/40 space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-200">Accountability Partner Sync</h3>
              <p className="text-[11px] text-zinc-550">Alignment rating based on completion of shared/monitored tasks.</p>
            </div>
            
            <div className="space-y-4 overflow-y-auto max-h-60 pt-2 flex-1">
              {((analytics as any).partners || []).length === 0 ? (
                <p className="text-[11px] text-zinc-600 italic text-center py-8">No partners linked for analytics.</p>
              ) : (
                ((analytics as any).partners as any[]).map((p) => {
                  const rating = 
                    p.completionRate >= 80 ? "High Alignment 🔥" : 
                    p.completionRate >= 50 ? "Moderate Alignment 📈" : 
                    "Low Alignment ⚠️";
                  const ratingColor = 
                    p.completionRate >= 80 ? "text-emerald-400" : 
                    p.completionRate >= 50 ? "text-indigo-400" : 
                    "text-amber-500";
                  
                  return (
                    <div key={p.partnerId} className="flex items-center justify-between gap-4 border-b border-zinc-900/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300 flex items-center justify-center shrink-0">
                          {p.name ? p.name[0].toUpperCase() : p.username[0].toUpperCase()}
                        </div>
                        <div className="truncate text-left">
                          <span className="text-xs font-semibold text-zinc-200 block truncate">{p.name || p.username}</span>
                          <span className="text-[9px] text-zinc-550 block truncate uppercase">{p.mode} partner</span>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-zinc-200 block">{p.completionRate}% Done</span>
                        <span className={cn("text-[9px] font-bold block mt-0.5", ratingColor)}>{rating}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Chart and Details Split Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Display */}
          <Card className="lg:col-span-2 p-6 border-zinc-900 bg-zinc-950/40 flex flex-col space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-200">Activity Distribution</h3>
              <p className="text-[11px] text-zinc-550 mt-1">Daily frequency of verification updates over recent active dates.</p>
            </div>
            {chartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-900 rounded-xl">
                <BarChart3 className="h-8 w-8 text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-555 italic">No activity recorded for this period.</p>
              </div>
            ) : (
              <div className="h-64 flex items-end justify-between gap-4 pt-4 px-2">
                {chartData.map(([dayStr, count]) => {
                  const dayName = new Date(dayStr).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
                  const pct = Math.max((count / maxActivityCount) * 100, 8);
                  return (
                    <div key={dayStr} className="flex-1 flex flex-col items-center gap-2 group cursor-default">
                      <div className="relative w-full flex justify-center">
                        <div className="absolute bottom-full mb-2 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 font-bold">
                          {count} check-in{count > 1 ? 's' : ''}
                        </div>
                        <div
                          className="w-8 sm:w-12 rounded-t-lg bg-gradient-to-t from-indigo-900/60 to-indigo-500/80 group-hover:to-cyan-400/90 transition-all duration-300"
                          style={{ height: `${pct}%`, minHeight: '12px' }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-zinc-555 group-hover:text-zinc-300 transition-colors mt-1 select-none">{dayName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Outcomes Breakdown */}
          <Card className="p-6 border-zinc-900 bg-zinc-950/40 space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-200">Outcome Distribution</h3>
              <p className="text-[11px] text-zinc-550 mt-1">Breakdown of active checkpoints by state.</p>
            </div>
            
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed</span>
                  <span>{metrics.completedCheckIns} ({metrics.totalCheckIns ? Math.round((metrics.completedCheckIns / metrics.totalCheckIns) * 100) : 0}%)</span>
                </div>
                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${metrics.totalCheckIns ? (metrics.completedCheckIns / metrics.totalCheckIns) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> In Progress</span>
                  <span>{metrics.inProgressCheckIns} ({metrics.totalCheckIns ? Math.round((metrics.inProgressCheckIns / metrics.totalCheckIns) * 100) : 0}%)</span>
                </div>
                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${metrics.totalCheckIns ? (metrics.inProgressCheckIns / metrics.totalCheckIns) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-zinc-300">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Missed</span>
                  <span>{metrics.missedCheckIns} ({metrics.totalCheckIns ? Math.round((metrics.missedCheckIns / metrics.totalCheckIns) * 100) : 0}%)</span>
                </div>
                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${metrics.totalCheckIns ? (metrics.missedCheckIns / metrics.totalCheckIns) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-zinc-900 text-[10px] text-zinc-500 leading-relaxed font-semibold">
              Consistency is key. Maintaining a missed score below 15% is recommended to protect your streak score.
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // TAB: Workspace tab render
  const renderWorkspaceTab = () => {
    const totalWorkspaces = workspaces.length;
    const totalTasksCount = tasks.length;
    const completedTasksCount = tasks.filter(t => t.status === "COMPLETED").length;
    const overallCompletionRate = totalTasksCount ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
    
    const now = new Date();
    const totalOverdueTasksCount = tasks.filter(t => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < now).length;

    return (
      <div className="space-y-8 max-w-6xl mx-auto text-left animate-fade-in">
        {/* Header Section */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Workspace Hub
          </h1>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            Organize your goals, tasks, and shared workspaces with your mutual accountability partners.
          </p>
        </div>

        {/* Combined Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-zinc-950/40 border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Workspaces</span>
            <p className="text-2xl font-bold text-zinc-100 mt-2">{totalWorkspaces}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Personal and shared spaces</p>
          </Card>
          <Card className="p-4 bg-zinc-950/40 border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Combined Tasks</span>
            <p className="text-2xl font-bold text-indigo-400 mt-2">{totalTasksCount}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Total targets assigned</p>
          </Card>
          <Card className="p-4 bg-zinc-950/40 border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Completion Velocity</span>
            <p className="text-2xl font-bold text-emerald-400 mt-2">{overallCompletionRate}%</p>
            <p className="text-[10px] text-zinc-500 mt-1">Overall completion rate</p>
          </Card>
          <Card className={`p-4 transition-all duration-300 ${totalOverdueTasksCount > 0 ? 'bg-red-950/30 border-red-900/60 shadow-lg shadow-red-950/20' : 'bg-zinc-950/40 border-zinc-900'}`}>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Overdue</span>
            <p className={`text-2xl font-bold mt-2 ${totalOverdueTasksCount > 0 ? 'text-red-400' : 'text-zinc-100'}`}>{totalOverdueTasksCount}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Uncompleted past due dates</p>
          </Card>
        </div>

        {/* Create workspace and seed buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-950/30 border border-zinc-900 p-4 rounded-xl">
          <form onSubmit={handleCreateWorkspace} className="flex flex-1 max-w-md gap-2">
            <input
              type="text"
              placeholder="Create new workspace..."
              value={workspaceNameInput}
              onChange={(e) => setWorkspaceNameInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-650 focus:border-zinc-700 focus:outline-none font-semibold"
            />
            <Button type="submit" size="sm" className="h-8.5 text-xs font-semibold px-4">
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </form>
          <button 
            onClick={handleRestoreDefaultWorkspaces}
            className="text-xs text-zinc-400 hover:text-indigo-400 transition-colors flex items-center justify-center gap-1 font-semibold border border-zinc-900 px-3 py-1.5 rounded-lg bg-zinc-950/20"
          >
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Restore Defaults
          </button>
        </div>

        {/* Workspaces Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workspaces.map((w) => {
            const isMyWorkspace = (w.userId as any)?.id === user?.id || w.userId === user?.id;
            const ownerUsername = (w.userId as any)?.username;
            
            const wsTasks = tasks.filter(t => t.workspaceId === w.id);
            const totalWsTasks = wsTasks.length;
            const completedWsTasks = wsTasks.filter(t => t.status === "COMPLETED").length;
            const inProgressWsTasks = wsTasks.filter(t => t.status === "IN_PROGRESS").length;
            const pendingWsTasks = wsTasks.filter(t => t.status === "PENDING").length;
            const overdueWsTasks = wsTasks.filter(t => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < now).length;
            
            const wsCompletionRate = totalWsTasks ? Math.round((completedWsTasks / totalWsTasks) * 100) : 0;

            const isEditing = editingWorkspaceId === w.id;

            return (
              <Card key={w.id} className="p-5 border-zinc-900 bg-zinc-950/20 relative group hover:border-zinc-800 transition-all duration-300 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Workspace Card Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-left flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          className="px-2 py-1 rounded bg-zinc-900 border border-indigo-500 text-zinc-100 text-sm font-semibold focus:outline-none w-full"
                          value={editingWorkspaceName}
                          onChange={(e) => setEditingWorkspaceName(e.target.value)}
                          onBlur={() => handleUpdateWorkspaceName(w.id, editingWorkspaceName)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateWorkspaceName(w.id, editingWorkspaceName);
                            if (e.key === "Escape") setEditingWorkspaceId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-zinc-200">{w.name}</h3>
                          {w.isDefault && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0 uppercase">Default</Badge>
                          )}
                          {!isMyWorkspace && (
                            <Badge variant="success" className="text-[8px] px-1.5 py-0 uppercase tracking-wide bg-indigo-950/60 border-indigo-900/40 text-indigo-400">
                              Mutual Partner: @{ownerUsername}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {isMyWorkspace && !isEditing && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingWorkspaceId(w.id);
                            setEditingWorkspaceName(w.name);
                          }}
                          className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-all"
                          title="Rename workspace"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorkspace(w.id)}
                          className="p-1 rounded hover:bg-red-950/20 text-zinc-500 hover:text-red-400 transition-all"
                          title="Delete workspace"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar & Stats */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold">
                      <span>Task Completion</span>
                      <span>{wsCompletionRate}% ({completedWsTasks}/{totalWsTasks})</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500" 
                        style={{ width: `${wsCompletionRate}%` }} 
                      />
                    </div>
                    
                    {/* Small stats badges */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                        {pendingWsTasks} Pending
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-950/40 text-purple-400">
                        {inProgressWsTasks} Active
                      </span>
                      {overdueWsTasks > 0 && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/30 animate-pulse">
                          {overdueWsTasks} Overdue
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Partners added to this workspace */}
                  {w.collaboratorIds && w.collaboratorIds.length > 0 && (
                    <div className="pt-2.5 border-t border-zinc-900/40 text-left">
                      <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block mb-1.5">
                        Assigned Partners
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {w.collaboratorIds.map((partner: any) => (
                          <div 
                            key={partner.id} 
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900/60 border border-zinc-900 text-[10px] text-zinc-300 font-semibold"
                          >
                            <span>@{partner.username}</span>
                            {isMyWorkspace && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Remove @${partner.username} from this workspace?`)) {
                                    try {
                                      await workspaceService.removePartnerFromWorkspace(w.id, partner.id);
                                      const workspacesList = await workspaceService.getWorkspaces();
                                      setWorkspaces(workspacesList);
                                    } catch (err) {
                                      console.error("Failed to remove partner from workspace:", err);
                                    }
                                  }
                                }}
                                className="text-red-400 hover:text-red-300 font-bold shrink-0 pl-1 ml-1 border-l border-zinc-800 focus:outline-none"
                                title="Remove partner"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks List */}
                  <div className="space-y-2 pt-3 border-t border-zinc-900/50">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Workspace Tasks</span>
                    {wsTasks.length === 0 ? (
                      <p className="text-[10px] text-zinc-650 italic text-center py-4">No tasks in this workspace.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {wsTasks.map(t => (
                          <div key={t.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-zinc-950/40 border border-zinc-900/40 hover:border-zinc-800/80 transition-all">
                            <div className="flex items-start gap-2 flex-1">
                              <button
                                onClick={() => handleToggleTaskStatus(t.id)}
                                className="mt-0.5 text-zinc-500 hover:text-indigo-400 transition-colors focus:outline-none shrink-0"
                              >
                                {t.status === "COMPLETED" ? (
                                  <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                                ) : t.status === "IN_PROGRESS" ? (
                                  <Clock className="h-4 w-4 text-purple-400" />
                                ) : (
                                  <Circle className="h-4 w-4 text-zinc-850" />
                                )}
                              </button>
                              <div className="text-left flex-1 min-w-0">
                                <p 
                                  onClick={() => navigate(`/tasks/${t.id}`)}
                                  className={cn(
                                    "text-xs font-semibold truncate cursor-pointer hover:text-indigo-400 hover:underline",
                                    t.status === "COMPLETED" ? "line-through text-zinc-555" : "text-zinc-200"
                                  )}
                                >
                                  {t.title}
                                </p>
                                {t.dueDate && (
                                  <span className="text-[8px] text-zinc-500 font-semibold block mt-0.5">
                                    Due {new Date(t.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <Badge 
                              variant={t.priority === "HIGH" ? "destructive" : t.priority === "MEDIUM" ? "warning" : "secondary"} 
                              className="text-[8px] px-1 py-0 shrink-0"
                            >
                              {t.priority.toLowerCase()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline task creator inside Workspace card */}
                <div className="mt-4 pt-3 border-t border-zinc-900/50">
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as any;
                      const title = form.elements.taskTitle.value.trim();
                      if (!title) return;
                      
                      try {
                        await taskService.createTask({
                          title,
                          description: "",
                          priority: "MEDIUM",
                          dueDate: null,
                          isPrivate: false,
                          workspaceId: w.id
                        });
                        form.reset();
                        await loadDashboardData();
                      } catch (err) {
                        console.error("Failed to quick create task:", err);
                      }
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      name="taskTitle"
                      type="text"
                      placeholder="Add quick task..."
                      className="flex-1 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-900 text-[11px] placeholder:text-zinc-650 text-zinc-200 focus:outline-none focus:border-zinc-700 font-semibold"
                    />
                    <Button type="submit" size="sm" className="h-6.5 text-[9px] px-2.5 font-bold">
                      Add
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
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
              
              {/* Workspaces Horizontal Bar */}
              <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-xl space-y-3 shadow-md shadow-zinc-950/20 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Folder className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Workspaces</span>
                  </div>
                  <button 
                    onClick={handleRestoreDefaultWorkspaces} 
                    className="text-[10px] text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1 font-semibold"
                    title="Restore Personal & Work defaults"
                  >
                    <RefreshCcw className="h-3 w-3" /> Restore Defaults
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none flex-wrap">
                  <button
                    onClick={() => setSelectedWorkspaceId("all")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                      selectedWorkspaceId === "all" 
                        ? "bg-indigo-650 text-white border-indigo-650 shadow-lg shadow-indigo-600/20" 
                        : "bg-zinc-900/60 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    All Workspaces
                  </button>
                  <button
                    onClick={() => setSelectedWorkspaceId("none")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                      selectedWorkspaceId === "none" 
                        ? "bg-indigo-650 text-white border-indigo-650 shadow-lg shadow-indigo-600/20" 
                        : "bg-zinc-900/60 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    Inbox (Unassigned)
                  </button>
                  {workspaces.map((w) => {
                    const isSelected = selectedWorkspaceId === w.id;
                    const isEditing = editingWorkspaceId === w.id;
                    return (
                      <div key={w.id} className="relative shrink-0 flex items-center">
                        {isEditing ? (
                          <input
                            type="text"
                            className="px-2.5 py-1 rounded-lg text-xs bg-zinc-900 border border-indigo-500 text-zinc-100 font-semibold focus:outline-none w-28"
                            value={editingWorkspaceName}
                            onChange={(e) => setEditingWorkspaceName(e.target.value)}
                            onBlur={() => handleUpdateWorkspaceName(w.id, editingWorkspaceName)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdateWorkspaceName(w.id, editingWorkspaceName);
                              if (e.key === "Escape") setEditingWorkspaceId(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center">
                            <button
                              onClick={() => setSelectedWorkspaceId(w.id)}
                              className={cn(
                                "pl-3 pr-2 py-1.5 rounded-l-lg text-xs font-semibold transition-all border-y border-l shrink-0",
                                isSelected 
                                  ? "bg-indigo-650 text-white border-indigo-650" 
                                  : "bg-zinc-900/60 text-zinc-400 border-zinc-900 hover:border-zinc-800 hover:text-zinc-200"
                              )}
                            >
                              {w.name}
                            </button>
                            <div className={cn(
                              "flex items-center gap-1 pr-1.5 py-1.5 rounded-r-lg border-y border-r transition-all shrink-0",
                              isSelected
                                ? "bg-indigo-650 border-indigo-650 text-indigo-200"
                                : "bg-zinc-900/60 border-zinc-900 text-zinc-600"
                            )}>
                              <button
                                onClick={() => {
                                  setEditingWorkspaceId(w.id);
                                  setEditingWorkspaceName(w.name);
                                }}
                                className="hover:text-zinc-200 transition-colors p-0.5"
                                title="Rename"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkspace(w.id)}
                                className="hover:text-red-400 transition-colors p-0.5"
                                title="Delete"
                              >
                                <Trash className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Quick Add Workspace form inline */}
                  <form onSubmit={handleCreateWorkspace} className="flex items-center gap-1 pl-1">
                    <input
                      type="text"
                      placeholder="New Workspace..."
                      value={workspaceNameInput}
                      onChange={(e) => setWorkspaceNameInput(e.target.value)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-zinc-950 border border-zinc-900 text-zinc-350 focus:border-zinc-700 focus:outline-none w-28 placeholder:text-zinc-650 font-semibold"
                    />
                    <button 
                      type="submit"
                      className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-indigo-400 transition-colors shrink-0"
                      title="Create Workspace"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>

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
                  {filteredOverdueTasks && filteredOverdueTasks.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs tracking-wide uppercase">
                        <AlertTriangle className="h-4 w-4 animate-bounce text-red-500" />
                        <span>Urgent: Overdue Tasks ({filteredOverdueTasks.length})</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {filteredOverdueTasks.map((task) => (
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
                                      <Calendar className="h-3.5 w-3.5" /> Overdue since {task.dueDate ? new Date(task.dueDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ""}
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
                  {filteredSharedTasks && filteredSharedTasks.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-bold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-emerald-400" /> Shared Targets Board
                      </h2>
                      <div className="space-y-3">
                        {filteredSharedTasks.map((task) => {
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
                        {filteredTasks.filter(t => t.status !== "COMPLETED").length} Remaining
                      </Badge>
                    </div>

                    {filteredTasks.length === 0 ? (
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
                        {filteredTasks.map((task) => (
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
                                    <Calendar className="h-3.5 w-3.5" /> Due {task.dueDate ? new Date(task.dueDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "No target date"}
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
                    {(() => {
                      const selectedTask = (dashboardData?.sharedTasks || []).find(t => t.id === checkInTaskId) || tasks.find(t => t.id === checkInTaskId);
                      const isCreator = selectedTask 
                        ? ((selectedTask.creatorId as any)?.id === user?.id || selectedTask.creatorId === user?.id)
                        : true;
                      return (
                        <select
                          value={checkInStatus}
                          onChange={(e) => setCheckInStatus(e.target.value as CheckInStatus)}
                          className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                        >
                          {isCreator && <option value="COMPLETED">Completed</option>}
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="MISSED">Missed</option>
                        </select>
                      );
                    })()}
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
                  label="Target Date and Time"
                  type="datetime-local"
                  min={getMinDateTimeString()}
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">Workspace</label>
                  <select
                    value={newTaskWorkspaceId}
                    onChange={(e) => setNewTaskWorkspaceId(e.target.value)}
                    className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  >
                    <option value="">Inbox (No Workspace)</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div 
                  className="flex items-center gap-3 bg-zinc-950/30 border border-zinc-900 px-4 py-2 rounded-lg text-left self-end h-[38px] cursor-pointer" 
                  onClick={() => setNewTaskIsPrivate(!newTaskIsPrivate)}
                >
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-zinc-250 transition-colors focus:outline-none"
                  >
                    {newTaskIsPrivate ? (
                      <Lock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Unlock className="h-4 w-4 text-zinc-500" />
                    )}
                  </button>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-300">Private Task</span>
                    <span className="text-[8px] text-zinc-500 leading-tight">Accountability partners won't be linked</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newTaskIsPrivate}
                    onChange={(e) => setNewTaskIsPrivate(e.target.checked)}
                    className="ml-auto accent-indigo-500 rounded border-zinc-800"
                  />
                </div>
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
                    
                    const selectedTask = tasks.find((t) => t.id === inviteTaskId);
                    const isAlreadyCollaboratorOnTask = selectedTask ? (
                      ((selectedTask.creatorId as any)?.id || (selectedTask.creatorId as any)?._id) === profile.id ||
                      ((selectedTask.partnerId as any)?.id || (selectedTask.partnerId as any)?._id) === profile.id ||
                      (selectedTask.collaboratorIds as any[] || []).some((c: any) => (c?.id || c?._id || c) === profile.id)
                    ) : false;

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
                          disabled={submittingInvite || !inviteTaskId || isAlreadyCollaboratorOnTask || !!existingInvite}
                          onClick={() => handleSendInvite(profile)}
                          className="h-7 text-[10px] px-3 font-semibold"
                        >
                          {isAlreadyCollaboratorOnTask ? "Collaborator" : existingInvite ? existingInvite.status.toLowerCase() : "Send Invite"}
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
      ) : activeTab === "workspace" ? (
        renderWorkspaceTab()
      ) : activeTab === "analytics" ? (
        renderAnalyticsTab()
      ) : activeTab === "partners" ? (
        renderPartnersTab()
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
