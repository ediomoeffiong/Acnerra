import * as React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "../components/layouts/AppLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { taskService } from "../services/taskService";
import type { Task, TaskStatus, TaskPriority } from "../services/taskService";
import { 
  ArrowLeft, Calendar, Trash2, Edit2, CheckCircle2, 
  Clock, Circle, ShieldAlert, AlertCircle, Sparkles
} from "lucide-react";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [task, setTask] = React.useState<Task | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  
  // Edit form states
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editPriority, setEditPriority] = React.useState<TaskPriority>("MEDIUM");
  const [editStatus, setEditStatus] = React.useState<TaskStatus>("PENDING");
  const [editDueDate, setEditDueDate] = React.useState("");

  const fetchTask = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const fetchedTask = await taskService.getTask(id);
      setTask(fetchedTask);
      
      // Initialize edit states
      setEditTitle(fetchedTask.title);
      setEditDescription(fetchedTask.description || "");
      setEditPriority(fetchedTask.priority);
      setEditStatus(fetchedTask.status);
      setEditDueDate(fetchedTask.dueDate ? fetchedTask.dueDate.split('T')[0] : "");
    } catch (err: any) {
      console.error("Error fetching task details:", err);
      if (err.response?.status === 403) {
        setError("You do not have permission to view this task. Ownership check failed.");
      } else if (err.response?.status === 404) {
        setError("The requested task could not be found.");
      } else {
        setError("An error occurred while loading the task details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editTitle.trim()) return;

    try {
      const updated = await taskService.updateTask(id, {
        title: editTitle,
        description: editDescription,
        status: editStatus,
        priority: editPriority,
        dueDate: editDueDate || null
      });
      
      setTask(updated);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  const handleDeleteTask = async () => {
    if (!id) return;
    try {
      await taskService.deleteTask(id);
      setIsDeleteModalOpen(false);
      navigate("/dashboard");
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleQuickStatusCycle = async () => {
    if (!task || !id) return;
    
    // Cycle logic: PENDING -> IN_PROGRESS -> COMPLETED -> PENDING
    let nextStatus: TaskStatus = "PENDING";
    if (task.status === "PENDING") nextStatus = "IN_PROGRESS";
    else if (task.status === "IN_PROGRESS") nextStatus = "COMPLETED";

    try {
      const updated = await taskService.updateTask(id, { status: nextStatus });
      setTask(updated);
      setEditStatus(nextStatus);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Helper to get priority badge details
  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "HIGH":
        return <Badge variant="destructive">High</Badge>;
      case "MEDIUM":
        return <Badge variant="warning">Medium</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  // Helper to get status badge and icon
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold text-sm">Completed</span>
          </div>
        );
      case "IN_PROGRESS":
        return (
          <div className="flex items-center gap-1.5 text-purple-400">
            <Clock className="h-5 w-5 text-purple-400" />
            <span className="font-semibold text-sm">In Progress</span>
          </div>
        );
      case "PENDING":
        return (
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Circle className="h-5 w-5 text-zinc-600" />
            <span className="font-semibold text-sm">Pending</span>
          </div>
        );
    }
  };

  return (
    <AppLayout activeTab="dashboard" setActiveTab={() => {}}>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Back Link Header */}
        <div className="flex items-center justify-between">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Space board
          </Link>
          {!loading && !error && task && (
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsEditModalOpen(true)} 
                variant="outline" 
                size="sm"
                className="h-8 font-semibold text-xs border-zinc-800 hover:bg-zinc-900"
              >
                <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit details
              </Button>
              <Button 
                onClick={() => setIsDeleteModalOpen(true)} 
                variant="outline" 
                size="sm"
                className="h-8 font-semibold text-xs border-red-950 text-red-400 hover:bg-red-950/20"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          /* Premium Loading Skeleton */
          <Card className="p-8 border-zinc-900 bg-zinc-950/40 space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-2/3" />
            </div>
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        ) : error ? (
          /* Error State UI */
          <Card className="p-8 border-red-900/20 bg-red-950/5 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Access Restricted</h2>
              <p className="text-sm text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">{error}</p>
            </div>
            <div className="pt-2">
              <Button onClick={() => navigate("/dashboard")} size="sm">
                Return to Dashboard
              </Button>
            </div>
          </Card>
        ) : task ? (
          /* Premium Detailed View Card */
          <div className="space-y-6">
            <Card className="p-8 border-zinc-900 bg-zinc-950/40 relative overflow-hidden space-y-6">
              {/* Premium Glow Aesthetic */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
              
              {/* Header section with statuses */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900/80 pb-5">
                <div className="flex items-center gap-3">
                  {getStatusBadge(task.status)}
                  <button 
                    onClick={handleQuickStatusCycle}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider underline cursor-pointer"
                  >
                    Quick Advance
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">Priority:</span>
                  {getPriorityBadge(task.priority)}
                </div>
              </div>

              {/* Title and Description */}
              <div className="space-y-3.5">
                <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight leading-tight">
                  {task.title}
                </h1>
                
                {task.description ? (
                  <p className="text-zinc-300/90 text-sm leading-relaxed whitespace-pre-wrap max-w-2xl bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/60">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-zinc-600 text-xs italic">No description provided for this accountability target.</p>
                )}
              </div>

              {/* Due date & Timeline details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-900/60 pt-5">
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-zinc-950/20 border border-zinc-900/40">
                  <Calendar className="h-4.5 w-4.5 text-zinc-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Target Due Date</span>
                    <span className="text-xs font-semibold text-zinc-200 mt-0.5">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                      }) : "No deadline assigned"}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-zinc-950/20 border border-zinc-900/40">
                  <Sparkles className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Task Origin</span>
                    <span className="text-xs font-semibold text-zinc-200 mt-0.5">
                      Created by you on {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Micro-Accountability Info panel */}
            <Card className="p-5 border-zinc-900 bg-zinc-950/20 flex items-start gap-3.5">
              <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-200 tracking-wide uppercase">Accountability Focus</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  This task is tied to your individual space. Any status changes or updates are tracked in your activity stream. Maintain your velocity targets to ensure consistent progress.
                </p>
              </div>
            </Card>
          </div>
        ) : null}

        {/* Modal Overlay: Edit Task */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
        >
          <form onSubmit={handleUpdateTask} className="space-y-4">
            <Input
              id="editTitle"
              label="Task Title"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Implement Prisma migrations"
            />
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                placeholder="Detailed objectives..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            <Input
              id="editDueDate"
              label="Target Date"
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900 mt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} size="sm">
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Overlay: Delete Task Confirmation */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Confirm Deletion"
        >
          <div className="space-y-4">
            <p className="text-sm text-zinc-300 leading-relaxed">
              Are you absolutely sure you want to delete task <span className="font-semibold text-zinc-100">"{task?.title}"</span>? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setIsDeleteModalOpen(false)} size="sm">
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleDeleteTask} 
                className="bg-red-600 hover:bg-red-700 text-white border-none"
                size="sm"
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
