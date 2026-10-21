import * as React from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { 
  Search, LayoutGrid, List, CheckCircle2, Circle, 
  AlertTriangle, Calendar, Users, Lock, Repeat, ChevronRight,
  TrendingUp, Flag
} from "lucide-react";
import type { Task } from "../../services/taskService";
import { useNavigate } from "react-router-dom";

interface MyTasksSectionProps {
  tasks: Task[];
  workspaces?: Array<{ id: string; name: string }>;
  onCompleteTask?: (taskId: string) => Promise<void>;
  onOpenRescheduleModal?: (taskId: string) => void;
  onOpenNewTask?: () => void;
  initialFilter?: string;
}

export const MyTasksSection: React.FC<MyTasksSectionProps> = ({
  tasks,
  workspaces = [],
  onCompleteTask,
  onOpenRescheduleModal,
  onOpenNewTask,
  initialFilter,
}) => {
  const navigate = useNavigate();

  // Filters & State
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>(initialFilter || "ALL");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("ALL");
  const [workspaceFilter, setWorkspaceFilter] = React.useState<string>("ALL");
  const [dueDateFilter, setDueDateFilter] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<string>("DUE_DATE_ASC");
  const [viewMode, setViewMode] = React.useState<"list" | "card">("card");
  const [completingId, setCompletingId] = React.useState<string | null>(null);

  // Sync initialFilter
  React.useEffect(() => {
    if (initialFilter) setStatusFilter(initialFilter);
  }, [initialFilter]);

  // Filter & Sort Logic
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      // 1. Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesDesc = (t.description || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 2. Status
      if (statusFilter === "OVERDUE") {
        if (!t.isOverdue || t.status === "COMPLETED") return false;
      } else if (statusFilter !== "ALL") {
        if (t.status !== statusFilter) return false;
      }

      // 3. Priority
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) {
        return false;
      }

      // 4. Workspace
      if (workspaceFilter !== "ALL") {
        const wsId = typeof t.workspaceId === "object" ? (t.workspaceId as any)?.id : t.workspaceId;
        if (wsId !== workspaceFilter) return false;
      }

      // 5. Due date filter
      if (dueDateFilter !== "ALL" && t.dueDate) {
        const due = new Date(t.dueDate);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (dueDateFilter === "TODAY") {
          if (due < todayStart || due > todayEnd) return false;
        } else if (dueDateFilter === "WEEK") {
          if (due < todayStart || due > weekEnd) return false;
        } else if (dueDateFilter === "LATER") {
          if (due <= weekEnd) return false;
        }
      } else if (dueDateFilter !== "ALL" && !t.dueDate) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "DUE_DATE_ASC") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "DUE_DATE_DESC") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      }
      if (sortBy === "PROGRESS_DESC") {
        return (b.progress || 0) - (a.progress || 0);
      }
      if (sortBy === "PRIORITY_DESC") {
        const weight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (weight[b.priority] || 0) - (weight[a.priority] || 0);
      }
      // default: CREATED_DESC
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, search, statusFilter, priorityFilter, workspaceFilter, dueDateFilter, sortBy]);

  const handleToggleComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (!onCompleteTask) return;
    setCompletingId(taskId);
    try {
      await onCompleteTask(taskId);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and View Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-100">My Commitments</h2>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
            {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
          </Badge>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setViewMode("card")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "card" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Card View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "list" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <Input
              placeholder="Search by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-zinc-950/50"
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 px-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="DUE_DATE_ASC">Deadline: Earliest First</option>
              <option value="DUE_DATE_DESC">Deadline: Latest First</option>
              <option value="PRIORITY_DESC">Priority: Highest First</option>
              <option value="PROGRESS_DESC">Progress: Highest First</option>
              <option value="CREATED_DESC">Recently Created</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/60 text-xs">
          {/* Status Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 px-2 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="OVERDUE">Overdue</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Priority Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[11px]">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-7 px-2 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          {/* Due Date Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[11px]">Deadline:</span>
            <select
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value)}
              className="h-7 px-2 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 focus:outline-none"
            >
              <option value="ALL">Any Time</option>
              <option value="TODAY">Due Today</option>
              <option value="WEEK">Due This Week</option>
              <option value="LATER">Due Later</option>
            </select>
          </div>

          {/* Workspace Filter if present */}
          {workspaces.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 text-[11px]">Workspace:</span>
              <select
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                className="h-7 px-2 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 focus:outline-none"
              >
                <option value="ALL">All Workspaces</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters Button if any active */}
          {(statusFilter !== "ALL" || priorityFilter !== "ALL" || workspaceFilter !== "ALL" || dueDateFilter !== "ALL" || search) && (
            <button
              onClick={() => {
                setStatusFilter("ALL");
                setPriorityFilter("ALL");
                setWorkspaceFilter("ALL");
                setDueDateFilter("ALL");
                setSearch("");
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 ml-auto underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Task List / Grid Display */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-200">No tasks match your filter</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Try adjusting your search query, clearing filters, or create a new commitment.
            </p>
          </div>
          {onOpenNewTask && (
            <Button size="sm" variant="outline" onClick={onOpenNewTask} className="mt-2">
              Create New Task
            </Button>
          )}
        </div>
      ) : viewMode === "card" ? (
        /* CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const isOverdue = task.isOverdue && !isCompleted;
            const progress = task.progress ?? (isCompleted ? 100 : 0);
            const subtasksCount = task.subtasks?.length || 0;
            const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
            const isRecurring = Boolean(task.isRecurringInstance || (task.recurrence && task.recurrence.frequency !== "NONE"));

            return (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 group hover:border-zinc-700 ${
                  isOverdue
                    ? "bg-red-950/15 border-red-500/30 hover:border-red-500/50"
                    : isCompleted
                    ? "bg-zinc-900/60 border-zinc-800/60 opacity-80"
                    : "bg-zinc-900/90 border-zinc-800/90"
                }`}
              >
                {/* Card Header: Title & Badges */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Priority Badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-2 ${
                          task.priority === "HIGH"
                            ? "border-red-500/30 text-red-400 bg-red-500/10"
                            : task.priority === "MEDIUM"
                            ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                            : "border-zinc-700 text-zinc-400"
                        }`}
                      >
                        {task.priority}
                      </Badge>

                      {/* Recurrence badge */}
                      {isRecurring && (
                        <span className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          <Repeat className="w-3 h-3" />
                          <span>{task.recurrence?.frequency || "Recurring"}</span>
                        </span>
                      )}

                      {/* Verification badge */}
                      {task.verificationRequired && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          task.verificationStatus === 'VERIFIED'
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-purple-500/10 border-purple-500/20 text-purple-400"
                        }`}>
                          {task.verificationStatus === 'VERIFIED' ? "✓ Verified" : "Verification"}
                        </span>
                      )}

                      {/* Overdue alert badge */}
                      {isOverdue && (
                        <button
                          type="button"
                          onClick={(e) => {
                            if (onOpenRescheduleModal) {
                              e.stopPropagation();
                              onOpenRescheduleModal(task.id);
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/20 font-semibold"
                          title="Click to reschedule"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Overdue</span>
                        </button>
                      )}
                    </div>

                    {/* Completion quick toggle button */}
                    <button
                      onClick={(e) => handleToggleComplete(e, task.id)}
                      disabled={completingId === task.id}
                      className={`shrink-0 p-1 rounded-full transition-colors ${
                        isCompleted
                          ? "text-emerald-400 hover:text-emerald-300"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                      title={isCompleted ? "Completed" : "Mark as Completed"}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className={`text-sm font-semibold group-hover:text-indigo-400 transition-colors line-clamp-1 ${
                      isCompleted ? "line-through text-zinc-400" : "text-zinc-100"
                    }`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-indigo-400" />
                      <span>Progress</span>
                    </span>
                    <span className="font-semibold text-zinc-300">{progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted
                          ? "bg-emerald-500"
                          : isOverdue
                          ? "bg-red-500"
                          : "bg-indigo-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Card Footer: Deadline, Subtasks, Partners */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-3">
                    {/* Due Date */}
                    {task.dueDate ? (
                      <span className={`flex items-center gap-1 text-[11px] ${
                        isOverdue ? "text-red-400 font-semibold" : "text-zinc-400"
                      }`}>
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-500">No deadline</span>
                    )}

                    {/* Subtasks Count */}
                    {subtasksCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                        <Flag className="w-3 h-3 text-zinc-500" />
                        <span>{completedSubtasks}/{subtasksCount}</span>
                      </span>
                    )}
                  </div>

                  {/* Visibility / Sharing */}
                  <div className="flex items-center gap-1 text-[11px]">
                    {task.visibility === "PRIVATE" ? (
                      <span className="flex items-center gap-1 text-zinc-500" title="Private to you">
                        <Lock className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-indigo-400 font-medium" title="Monitored by partners">
                        <Users className="w-3 h-3" />
                        <span>{(task.sharedWithIds || []).length}</span>
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 divide-y divide-zinc-800/80 overflow-hidden">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const isOverdue = task.isOverdue && !isCompleted;
            const progress = task.progress ?? (isCompleted ? 100 : 0);

            return (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="p-3.5 hover:bg-zinc-800/40 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={(e) => handleToggleComplete(e, task.id)}
                    className={`shrink-0 p-1 rounded-full ${
                      isCompleted ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold truncate ${
                        isCompleted ? "line-through text-zinc-500" : "text-zinc-200 group-hover:text-indigo-400"
                      }`}>
                        {task.title}
                      </span>
                      {isOverdue && (
                        <Badge variant="outline" className="border-red-500/30 text-red-400 text-[10px] py-0">
                          Overdue
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-500">{task.priority} Priority</span>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="text-[11px] text-zinc-500">
                          {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {/* Progress bar */}
                  <div className="w-24 hidden sm:block">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                      <span>Progress</span>
                      <span className="font-semibold text-zinc-300">{progress}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isCompleted ? "bg-emerald-500" : "bg-indigo-500"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
