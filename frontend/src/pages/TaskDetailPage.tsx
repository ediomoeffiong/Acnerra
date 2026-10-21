import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "../components/layouts/AppLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { taskService } from "../services/taskService";
import type { Task, TaskStatus, TaskPriority, TimelineEvent } from "../services/taskService";
import { checkInService } from "../services/checkInService";
import type { CheckIn, CheckInStatus, EvidenceItem } from "../services/checkInService";
import { workspaceService } from "../services/workspaceService";
import type { Workspace } from "../services/workspaceService";
import { useAuth } from "../context/AuthContext";
import { RescheduleModal } from "../components/dashboard/RescheduleModal";
import { 
  ArrowLeft, Calendar, Trash2, Edit2, CheckCircle2, 
  Clock, Circle, AlertCircle, Sparkles, MessageSquarePlus,
  Lock, Folder, Flag, Plus, Send, ShieldCheck, Repeat, 
  Paperclip, ExternalLink, FileText, Image as ImageIcon, History,
  TrendingUp, X, MessageSquare, Users
} from "lucide-react";

export default function TaskDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [task, setTask] = React.useState<Task | null>(null);
  const [checkIns, setCheckIns] = React.useState<CheckIn[]>([]);
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
  const [activeViewTab, setActiveViewTab] = React.useState<"checkins" | "timeline">("checkins");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = React.useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = React.useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = React.useState(false);
  
  // Subtasks & Milestones additions
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [addingSubtask, setAddingSubtask] = React.useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = React.useState("");
  const [newMilestoneDate, setNewMilestoneDate] = React.useState("");
  const [addingMilestone, setAddingMilestone] = React.useState(false);

  // CheckIn Form State
  const [checkInStatus, setCheckInStatus] = React.useState<CheckInStatus>("IN_PROGRESS");
  const [checkInNotes, setCheckInNotes] = React.useState("");
  const [checkInProgress, setCheckInProgress] = React.useState<number>(0);
  const [completedWork, setCompletedWork] = React.useState("");
  const [blockers, setBlockers] = React.useState("");
  const [nextSteps, setNextSteps] = React.useState("");
  const [isPrivateFeedback, setIsPrivateFeedback] = React.useState(false);
  const [evidenceList, setEvidenceList] = React.useState<EvidenceItem[]>([]);
  const [externalLinkUrl, setExternalLinkUrl] = React.useState("");
  const [externalLinkName, setExternalLinkName] = React.useState("");
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [submittingCheckIn, setSubmittingCheckIn] = React.useState(false);

  // Verification Form State
  const [verifyDecision, setVerifyDecision] = React.useState<"VERIFY" | "REQUEST_CLARIFICATION">("VERIFY");
  const [verifyNotes, setVerifyNotes] = React.useState("");
  const [submittingVerify, setSubmittingVerify] = React.useState(false);

  // Progress request state
  const [requestingProgress, setRequestingProgress] = React.useState(false);
  const [progressRequestMsg, setProgressRequestMsg] = React.useState<string | null>(null);

  // Edit form states
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editPriority, setEditPriority] = React.useState<TaskPriority>("MEDIUM");
  const [editStatus, setEditStatus] = React.useState<TaskStatus>("PENDING");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editWorkspaceId, setEditWorkspaceId] = React.useState("");
  const [submittingEdit, setSubmittingEdit] = React.useState(false);

  // Workspaces
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);

  const owner = task?.ownerId || task?.creatorId;
  const ownerId = typeof owner === "string" ? owner : owner?.id;
  const isOwner = task?.permissions?.isOwner ?? ownerId === user?.id;
  const canComment = task?.permissions?.canComment ?? false;
  const isMonitor = task?.permissions?.role === "MONITOR";
  const monitoringPartners = task?.sharedWithIds || task?.collaboratorIds || [];

  const workspaceName = React.useMemo(() => {
    if (!task?.workspaceId || workspaces.length === 0) return null;
    const w = workspaces.find(item => item.id === task.workspaceId || (item as any)._id === task.workspaceId);
    return w ? w.name : null;
  }, [task?.workspaceId, workspaces]);

  const loadTaskDetails = React.useCallback(async (background = false) => {
    if (!id) return;
    try {
      if (!background) setLoading(true);
      setError(null);
      const [fetchedTask, fetchedCheckIns, workspacesList, timelineData] = await Promise.all([
        taskService.getTask(id),
        checkInService.listCheckIns(id),
        workspaceService.getWorkspaces().catch(() => []),
        taskService.getTaskTimeline(id).catch(() => []),
      ]);
      setTask(fetchedTask);
      setCheckIns(fetchedCheckIns);
      setWorkspaces(workspacesList);
      setTimeline(timelineData);

      if (!background) {
        setEditTitle(fetchedTask.title);
        setEditDescription(fetchedTask.description || "");
        setEditPriority(fetchedTask.priority);
        setEditStatus(fetchedTask.status);
        setEditDueDate(fetchedTask.dueDate ? fetchedTask.dueDate.slice(0, 10) : "");
        setEditWorkspaceId(fetchedTask.workspaceId || "");
        setCheckInProgress(fetchedTask.progress || 0);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load task details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadTaskDetails();
  }, [loadTaskDetails]);

  // Subtask toggling & adding
  const handleToggleSubtask = async (subtaskId: string) => {
    if (!task || !isOwner) return;
    try {
      const updated = await taskService.toggleSubtask(task.id, subtaskId);
      setTask(updated);
      await loadTaskDetails(true);
    } catch (err) {
      console.error("Failed to toggle subtask:", err);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim() || !isOwner) return;
    setAddingSubtask(true);
    try {
      const updated = await taskService.addSubtask(task.id, { title: newSubtaskTitle.trim() });
      setTask(updated);
      setNewSubtaskTitle("");
      await loadTaskDetails(true);
    } catch (err) {
      console.error("Failed to add subtask:", err);
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task || !isOwner) return;
    try {
      const updated = await taskService.deleteSubtask(task.id, subtaskId);
      setTask(updated);
      await loadTaskDetails(true);
    } catch (err) {
      console.error("Failed to delete subtask:", err);
    }
  };

  // Milestone adding & completion
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newMilestoneTitle.trim() || !isOwner) return;
    setAddingMilestone(true);
    try {
      const updated = await taskService.addMilestone(task.id, {
        title: newMilestoneTitle.trim(),
        targetDate: newMilestoneDate ? new Date(newMilestoneDate).toISOString() : null,
      });
      setTask(updated);
      setNewMilestoneTitle("");
      setNewMilestoneDate("");
      await loadTaskDetails(true);
    } catch (err) {
      console.error("Failed to add milestone:", err);
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    if (!task || !isOwner) return;
    try {
      const updated = await taskService.updateMilestone(task.id, milestoneId, { status: "COMPLETED" });
      setTask(updated);
      await loadTaskDetails(true);
    } catch (err) {
      console.error("Failed to complete milestone:", err);
    }
  };

  // Evidence upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setUploadingFile(true);
    try {
      const evidence = await taskService.uploadEvidence(task.id, file);
      setEvidenceList([...evidenceList, evidence]);
    } catch (err: any) {
      alert(err?.response?.data?.message || "File upload failed.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddExternalLink = () => {
    if (!externalLinkUrl.trim()) return;
    const item: EvidenceItem = {
      id: `link_${Date.now()}`,
      type: "LINK",
      url: externalLinkUrl.trim(),
      name: externalLinkName.trim() || externalLinkUrl.trim(),
    };
    setEvidenceList([...evidenceList, item]);
    setExternalLinkUrl("");
    setExternalLinkName("");
  };

  // Submit CheckIn Form
  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setSubmittingCheckIn(true);
    try {
      await checkInService.createCheckIn(task.id, {
        status: checkInStatus,
        notes: checkInNotes.trim(),
        progress: isOwner ? checkInProgress : undefined,
        completedWork: completedWork.trim() || undefined,
        blockers: blockers.trim() || undefined,
        nextSteps: nextSteps.trim() || undefined,
        isPrivate: !isOwner && isPrivateFeedback,
        evidence: evidenceList,
      });
      setIsCheckInModalOpen(false);
      setCheckInNotes("");
      setCompletedWork("");
      setBlockers("");
      setNextSteps("");
      setEvidenceList([]);
      await loadTaskDetails(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to submit check-in.");
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  // Submit Verification Form
  const handleSubmitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setSubmittingVerify(true);
    try {
      const updated = await taskService.verifyTask(task.id, {
        decision: verifyDecision,
        notes: verifyNotes.trim() || undefined,
      });
      setTask(updated);
      setIsVerifyModalOpen(false);
      await loadTaskDetails(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to submit verification.");
    } finally {
      setSubmittingVerify(false);
    }
  };

  // Progress Request by Partner
  const handleAskProgressUpdate = async () => {
    if (!task) return;
    setRequestingProgress(true);
    setProgressRequestMsg(null);
    try {
      await taskService.createProgressRequest(task.id);
      setProgressRequestMsg("Progress update requested! The owner has been notified.");
    } catch (err: any) {
      setProgressRequestMsg(err?.response?.data?.message || "Could not request progress.");
    } finally {
      setRequestingProgress(false);
    }
  };

  // Save Edit Task
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !isOwner) return;
    setSubmittingEdit(true);
    try {
      const updated = await taskService.updateTask(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        status: editStatus,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        workspaceId: editWorkspaceId || null,
      });
      setTask(updated);
      setIsEditModalOpen(false);
      await loadTaskDetails(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update task.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !isOwner) return;
    try {
      await taskService.deleteTask(task.id);
      navigate("/dashboard");
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete task.");
    }
  };

  if (loading) {
    return (
      <AppLayout activeTab="dashboard" setActiveTab={() => {}}>
        <div className="p-16 text-center text-zinc-500 text-sm">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading commitment details...
        </div>
      </AppLayout>
    );
  }

  if (error || !task) {
    return (
      <AppLayout activeTab="dashboard" setActiveTab={() => {}}>
        <div className="p-12 text-center rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <h2 className="text-base font-bold text-zinc-100">Unable to load task</h2>
          <p className="text-xs text-zinc-400">{error || "Task not found."}</p>
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isCompleted = task.status === "COMPLETED";
  const isOverdue = task.isOverdue && !isCompleted;
  const progress = task.progress ?? (isCompleted ? 100 : 0);

  return (
    <AppLayout activeTab="dashboard" setActiveTab={() => {}}>
      <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
        {/* Navigation back and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 self-start transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Reschedule Button */}
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRescheduleModalOpen(true)}
                className="h-8 text-xs gap-1"
              >
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Reschedule</span>
              </Button>
            )}

            {/* Partner Ask Update Button */}
            {isMonitor && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAskProgressUpdate}
                loading={requestingProgress}
                className="h-8 text-xs gap-1"
              >
                <Send className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ask for Update</span>
              </Button>
            )}

            {/* CheckIn / Feedback Button */}
            {canComment && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCheckInModalOpen(true)}
                className="h-8 text-xs gap-1.5"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>{isOwner ? "Log Progress Update" : "Leave Partner Feedback"}</span>
              </Button>
            )}

            {/* Edit / Delete for Owner */}
            {isOwner && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                  className="h-8 text-xs px-2.5"
                  title="Edit details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="h-8 text-xs px-2.5"
                  title="Delete commitment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Progress request notification feedback */}
        {progressRequestMsg && (
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs">
            {progressRequestMsg}
          </div>
        )}

        {/* Main Task Header Card */}
        <Card className="p-6 border-zinc-800 bg-zinc-900/90 space-y-4 shadow-lg">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] py-0.5 px-2 ${
                  isCompleted
                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    : isOverdue
                    ? "border-red-500/30 text-red-400 bg-red-500/10"
                    : "border-zinc-700 text-zinc-300"
                }`}
              >
                {task.status.replace("_", " ")}
              </Badge>

              <Badge
                variant="outline"
                className={`text-[10px] py-0.5 px-2 ${
                  task.priority === "HIGH"
                    ? "border-red-500/30 text-red-400 bg-red-500/10"
                    : task.priority === "MEDIUM"
                    ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                {task.priority} Priority
              </Badge>

              {task.recurrence && task.recurrence.frequency !== "NONE" && (
                <span className="flex items-center gap-1 text-[11px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  <Repeat className="w-3 h-3" />
                  <span>Recurs {task.recurrence.frequency.toLowerCase()}</span>
                </span>
              )}

              {task.verificationRequired && (
                <span className={`text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                  task.verificationStatus === "VERIFIED"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-purple-500/10 border-purple-500/20 text-purple-400"
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  <span>
                    {task.verificationStatus === "VERIFIED"
                      ? "Completion Verified"
                      : task.verificationStatus === "NEEDS_CLARIFICATION"
                      ? "Clarification Requested"
                      : "Verification Required"}
                  </span>
                </span>
              )}

              {isOverdue && (
                <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10 text-[11px] py-0.5 animate-pulse">
                  Overdue
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
              {task.title}
            </h1>

            {task.description && (
              <p className="text-sm text-zinc-300 leading-relaxed pt-1">
                {task.description}
              </p>
            )}
          </div>

          {/* Progress Bar Section */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Overall Completion Progress</span>
              </span>
              <span className="font-bold text-zinc-200">{progress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isCompleted ? "bg-emerald-500" : isOverdue ? "bg-red-500" : "bg-indigo-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Due Date */}
              {task.dueDate ? (
                <span className={`flex items-center gap-1.5 ${isOverdue ? "text-red-400 font-semibold" : ""}`}>
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <span>Deadline: {new Date(task.dueDate).toLocaleDateString()}</span>
                </span>
              ) : (
                <span className="text-zinc-500">No deadline set</span>
              )}

              {/* Workspace */}
              {workspaceName && (
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <Folder className="w-4 h-4" />
                  <span>{workspaceName}</span>
                </span>
              )}

              {/* Owner tag */}
              <span className="text-zinc-400">
                Owner: <strong className="text-zinc-200">{isOwner ? "You" : typeof owner === "object" ? owner?.name || owner?.username : "Buddy"}</strong>
              </span>
            </div>

            {/* Sharing stats */}
            <div>
              {task.visibility === "PRIVATE" ? (
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Private task</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-purple-400 font-medium">
                  <Users className="w-3.5 h-3.5" />
                  <span>Monitored by {monitoringPartners.length} partner{monitoringPartners.length === 1 ? "" : "s"}</span>
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Verification Alert Banner if pending and user can verify */}
        {task.verificationRequired && task.verificationStatus === "PENDING" && (
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Task Marked Completed — Completion Verification Pending</span>
              </div>
              <p className="text-xs text-zinc-400">
                {isOwner
                  ? "A designated accountability partner has been asked to verify your completion."
                  : "As a monitoring partner, please review the progress and evidence to verify completion."}
              </p>
            </div>

            {isMonitor && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsVerifyModalOpen(true)}
                className="h-8 text-xs bg-purple-600 hover:bg-purple-500 shrink-0"
              >
                Review & Verify
              </Button>
            )}
          </div>
        )}

        {/* Two-Column Layout: Subtasks/Milestones on Left, Checkins/Timeline on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Subtasks & Milestones */}
          <div className="lg:col-span-1 space-y-6">
            {/* SUBTASKS CARD */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Flag className="w-4 h-4 text-indigo-400" />
                  <span>Subtasks ({(task.subtasks || []).filter((s) => s.completed).length}/{(task.subtasks || []).length})</span>
                </h3>
              </div>

              {/* Add subtask inline for owner */}
              {isOwner && (
                <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
                  <Input
                    placeholder="Add step / subtask..."
                    value={newSubtaskTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSubtaskTitle(e.target.value)}
                    className="h-8 text-xs bg-zinc-950"
                  />
                  <Button type="submit" size="sm" loading={addingSubtask} className="h-8 text-xs px-2.5 shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </form>
              )}

              {/* Subtasks list */}
              {(!task.subtasks || task.subtasks.length === 0) ? (
                <div className="text-xs text-zinc-500 py-3 text-center">
                  No subtasks defined.
                </div>
              ) : (
                <div className="space-y-1.5 divide-y divide-zinc-800/60 pt-1">
                  {task.subtasks.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-2 pt-1.5 text-xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOwner ? (
                          <button
                            onClick={() => handleToggleSubtask(st.id)}
                            className={`shrink-0 ${st.completed ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"}`}
                          >
                            {st.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </button>
                        ) : (
                          <div className={`shrink-0 ${st.completed ? "text-emerald-400" : "text-zinc-500"}`}>
                            {st.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </div>
                        )}
                        <span className={`truncate ${st.completed ? "line-through text-zinc-500" : "text-zinc-300"}`}>
                          {st.title}
                        </span>
                      </div>

                      {isOwner && (
                        <button
                          onClick={() => handleDeleteSubtask(st.id)}
                          className="text-zinc-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* MILESTONES CARD */}
            <Card className="p-4 border-zinc-800 bg-zinc-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Target Milestones ({(task.milestones || []).length})</span>
                </h3>
              </div>

              {/* Add milestone for owner */}
              {isOwner && (
                <form onSubmit={handleAddMilestone} className="space-y-2">
                  <Input
                    placeholder="Milestone title..."
                    value={newMilestoneTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMilestoneTitle(e.target.value)}
                    className="h-8 text-xs bg-zinc-950"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={newMilestoneDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMilestoneDate(e.target.value)}
                      className="h-8 text-xs bg-zinc-950 flex-1"
                    />
                    <Button type="submit" size="sm" loading={addingMilestone} className="h-8 text-xs px-2.5 shrink-0">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                </form>
              )}

              {/* Milestones list */}
              {(!task.milestones || task.milestones.length === 0) ? (
                <div className="text-xs text-zinc-500 py-3 text-center">
                  No milestones added.
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {task.milestones.map((ms) => {
                    const isMsDone = ms.status === "COMPLETED";
                    return (
                      <div
                        key={ms.id}
                        className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                          isMsDone
                            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-300"
                            : "bg-zinc-950 border-zinc-800 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold truncate">{ms.title}</span>
                          {isMsDone ? (
                            <Badge variant="outline" className="text-[9px] py-0 border-emerald-500/30 text-emerald-400">
                              Completed
                            </Badge>
                          ) : isOwner ? (
                            <button
                              onClick={() => handleCompleteMilestone(ms.id)}
                              className="text-[10px] text-indigo-400 hover:underline font-medium"
                            >
                              Mark Reached
                            </button>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0 border-zinc-700 text-zinc-400">
                              Pending
                            </Badge>
                          )}
                        </div>
                        {ms.targetDate && (
                          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Target: {new Date(ms.targetDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT: Check-ins & Timeline Tabs */}
          <div className="lg:col-span-2 space-y-4">
            {/* View Switch */}
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <button
                onClick={() => setActiveViewTab("checkins")}
                className={`pb-1 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeViewTab === "checkins"
                    ? "border-indigo-500 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Check-ins & Feedback ({checkIns.length})</span>
              </button>

              <button
                onClick={() => setActiveViewTab("timeline")}
                className={`pb-1 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ml-4 ${
                  activeViewTab === "timeline"
                    ? "border-indigo-500 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <History className="w-4 h-4" />
                <span>Complete Timeline ({timeline.length})</span>
              </button>
            </div>

            {/* TAB 1: CHECK-INS & FEEDBACK */}
            {activeViewTab === "checkins" && (
              <div className="space-y-3">
                {checkIns.length === 0 ? (
                  <div className="p-12 text-center rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
                    <MessageSquarePlus className="w-8 h-8 text-zinc-600 mx-auto" />
                    <div className="text-sm font-semibold text-zinc-300">No check-ins yet</div>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      {isOwner
                        ? "Post your first progress update to log what work was completed, current blockers, and next steps."
                        : "Leave constructive feedback or encouragement for your accountability partner."}
                    </p>
                    {canComment && (
                      <Button size="sm" variant="outline" onClick={() => setIsCheckInModalOpen(true)}>
                        {isOwner ? "Log Progress" : "Leave Feedback"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checkIns.map((ci) => {
                      const isOwnerProgress = ci.kind === "OWNER_PROGRESS";
                      const author = ci.userId?.name || ci.userId?.username || "A user";

                      return (
                        <div
                          key={ci.id}
                          className={`p-4 rounded-xl border space-y-2.5 ${
                            ci.isPrivate
                              ? "bg-purple-950/20 border-purple-500/30"
                              : "bg-zinc-900 border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-200">{author}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 ${
                                  isOwnerProgress
                                    ? "border-indigo-500/30 text-indigo-400"
                                    : "border-purple-500/30 text-purple-400"
                                }`}
                              >
                                {isOwnerProgress ? "Owner Update" : "Partner Feedback"}
                              </Badge>

                              {ci.isPrivate && (
                                <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                                  🔒 Private to owner
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-zinc-500">
                              {new Date(ci.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </div>

                          {/* Progress % indicator if present */}
                          {ci.progress !== undefined && ci.progress !== null && (
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <span>Reported progress:</span>
                              <span className="font-bold text-indigo-400">{ci.progress}%</span>
                            </div>
                          )}

                          {/* Completed Work / Notes */}
                          {ci.notes && (
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              {ci.notes}
                            </p>
                          )}
                          {ci.completedWork && (
                            <div className="text-xs space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-zinc-500">Work Completed:</span>
                              <p className="text-zinc-300">{ci.completedWork}</p>
                            </div>
                          )}
                          {ci.blockers && (
                            <div className="text-xs space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-red-400">Current Blockers:</span>
                              <p className="text-red-300/90">{ci.blockers}</p>
                            </div>
                          )}
                          {ci.nextSteps && (
                            <div className="text-xs space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-indigo-400">Next Steps:</span>
                              <p className="text-zinc-300">{ci.nextSteps}</p>
                            </div>
                          )}

                          {/* Evidence Attachments */}
                          {ci.evidence && ci.evidence.length > 0 && (
                            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Attached Evidence:
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {ci.evidence.map((ev, idx) => (
                                  <a
                                    key={idx}
                                    href={ev.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs text-indigo-400 hover:underline flex items-center gap-1.5"
                                  >
                                    {ev.type === "IMAGE" ? (
                                      <ImageIcon className="w-3.5 h-3.5" />
                                    ) : ev.type === "LINK" ? (
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    ) : (
                                      <FileText className="w-3.5 h-3.5" />
                                    )}
                                    <span className="truncate max-w-[160px]">{ev.name}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: COMPLETE TIMELINE */}
            {activeViewTab === "timeline" && (
              <div className="space-y-3">
                {timeline.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No timeline events recorded yet.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                    {timeline.map((event, idx) => {
                      const actorName = event.actor?.name || event.actor?.username || "A user";
                      return (
                        <div key={idx} className="relative space-y-1 text-xs">
                          {/* Timeline Dot */}
                          <div className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-zinc-950" />

                          <div className="flex items-center justify-between text-zinc-400">
                            <span className="font-semibold text-zinc-200">{event.title}</span>
                            <span className="text-[10px]">
                              {new Date(event.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </div>

                          <p className="text-zinc-400 leading-relaxed">{event.description}</p>
                          <span className="text-[10px] text-zinc-500">By {actorName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MODAL: LOG PROGRESS / LEAVE FEEDBACK */}
        <Modal
          isOpen={isCheckInModalOpen}
          onClose={() => setIsCheckInModalOpen(false)}
          title={isOwner ? "Submit Progress Check-in" : "Leave Partner Feedback"}
          size="lg"
        >
          <form onSubmit={handleSubmitCheckIn} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Status selection */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Status</label>
              <select
                value={checkInStatus}
                onChange={(e) => setCheckInStatus(e.target.value as CheckInStatus)}
                className="w-full h-9 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
              >
                <option value="IN_PROGRESS">In Progress</option>
                {isOwner && <option value="COMPLETED">Completed</option>}
                <option value="MISSED">Missed / Blocked</option>
              </select>
            </div>

            {/* Owner Progress Slider */}
            {isOwner && (
              <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-semibold">Current Progress Percentage:</span>
                  <span className="font-bold text-indigo-400">{checkInProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={checkInProgress}
                  onChange={(e) => setCheckInProgress(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            )}

            {/* Written Updates */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                {isOwner ? "What work did you complete?" : "Your Feedback & Encouragement"}
              </label>
              <textarea
                placeholder={isOwner ? "Finished the prototype, integrated APIs..." : "Great progress! Keep up the momentum..."}
                value={checkInNotes}
                onChange={(e) => setCheckInNotes(e.target.value)}
                rows={3}
                required
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Extra fields for owner */}
            {isOwner && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Current Blockers (Optional)</label>
                  <Input
                    placeholder="Waiting on review, technical bottleneck..."
                    value={blockers}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBlockers(e.target.value)}
                    className="h-8 text-xs bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Next Steps (Optional)</label>
                  <Input
                    placeholder="Deploy to staging, write documentation..."
                    value={nextSteps}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNextSteps(e.target.value)}
                    className="h-8 text-xs bg-zinc-900"
                  />
                </div>
              </div>
            )}

            {/* Private Feedback toggle for Partner */}
            {!isOwner && (
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Private Feedback</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Visible only to you and the task owner (hidden from other monitors).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivateFeedback}
                  onChange={(e) => setIsPrivateFeedback(e.target.checked)}
                  className="rounded text-purple-600 bg-zinc-800 border-zinc-700"
                />
              </div>
            )}

            {/* Evidence Attachments */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
              <span className="text-xs font-semibold text-zinc-200 block">
                Evidence Attachments (Optional)
              </span>

              {/* Upload file */}
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{uploadingFile ? "Uploading..." : "Upload File (Image/PDF/Doc)"}</span>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="hidden"
                  />
                </label>
              </div>

              {/* External link input */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="https://github.com/... or PR link"
                  value={externalLinkUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExternalLinkUrl(e.target.value)}
                  className="h-8 text-xs bg-zinc-950 flex-1"
                />
                <Button type="button" size="sm" onClick={handleAddExternalLink} className="h-8 text-xs shrink-0">
                  Add Link
                </Button>
              </div>

              {/* Evidence preview list */}
              {evidenceList.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {evidenceList.map((ev, idx) => (
                    <div key={idx} className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs flex items-center gap-2">
                      <span className="text-zinc-300 truncate max-w-[140px]">{ev.name}</span>
                      <button
                        type="button"
                        onClick={() => setEvidenceList(evidenceList.filter((_, i) => i !== idx))}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCheckInModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submittingCheckIn}>
                Submit
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: VERIFY COMPLETION */}
        <Modal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          title="Verify Task Completion"
          size="md"
        >
          <form onSubmit={handleSubmitVerify} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">Verification Decision</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyDecision("VERIFY")}
                  className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                    verifyDecision === "VERIFY"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  ✓ Verify Completed
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyDecision("REQUEST_CLARIFICATION")}
                  className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                    verifyDecision === "REQUEST_CLARIFICATION"
                      ? "bg-amber-500/20 border-amber-500 text-amber-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  ? Request Clarification
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Verification Notes / Feedback
              </label>
              <textarea
                placeholder={verifyDecision === "VERIFY" ? "Great job! Evidence confirmed..." : "Please attach screenshot or specify..."}
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsVerifyModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submittingVerify}>
                Submit Decision
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: RESCHEDULE */}
        <RescheduleModal
          task={task}
          isOpen={isRescheduleModalOpen}
          onClose={() => setIsRescheduleModalOpen(false)}
          onRescheduled={() => loadTaskDetails(true)}
        />

        {/* MODAL: EDIT TASK DETAILS */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Commitment Details"
          size="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Title</label>
              <Input
                value={editTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditPriority(e.target.value as TaskPriority)}
                  className="w-full h-9 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full h-9 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="MISSED">Missed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Deadline</label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDueDate(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submittingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL: DELETE CONFIRMATION */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Commitment"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to delete <strong>"{task.title}"</strong>? This will permanently remove all subtasks, milestones, and check-ins associated with this commitment.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteTask}>
                Delete Permanently
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
