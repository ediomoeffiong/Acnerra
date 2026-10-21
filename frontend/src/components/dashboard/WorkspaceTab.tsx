import * as React from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Folder, Plus, Trash2 } from "lucide-react";
import { workspaceService, type Workspace } from "../../services/workspaceService";
import type { Task } from "../../services/taskService";
import { useAuth } from "../../context/AuthContext";

interface WorkspaceTabProps {
  tasks: Task[];
  workspaces: Workspace[];
  onWorkspaceCreated: () => void;
  onSelectWorkspaceFilter: (workspaceId: string) => void;
}

export const WorkspaceTab: React.FC<WorkspaceTabProps> = ({
  tasks,
  workspaces,
  onWorkspaceCreated,
  onSelectWorkspaceFilter,
}) => {
  const { user } = useAuth();
  const [newWsName, setNewWsName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await workspaceService.createWorkspace(newWsName.trim());
      setNewWsName("");
      onWorkspaceCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create workspace.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (wsId: string) => {
    if (!window.confirm("Are you sure you want to delete this workspace?")) return;
    setDeletingId(wsId);
    try {
      await workspaceService.deleteWorkspace(wsId);
      onWorkspaceCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete workspace.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Workspaces Hub
          </h1>
          <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
            Organize commitments by project, goal category, or team scope.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Create Workspace Inline */}
      <form onSubmit={handleCreate} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="New workspace name (e.g. Health & Fitness, Startup Launch)..."
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            className="h-9 text-xs bg-zinc-950"
          />
        </div>
        <Button type="submit" size="sm" loading={creating} className="shrink-0 h-9">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Create Workspace
        </Button>
      </form>

      {/* Workspaces List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {workspaces.map((ws) => {
          const wsTasks = tasks.filter((t) => {
            const id = typeof t.workspaceId === "object" ? (t.workspaceId as any)?.id : t.workspaceId;
            return id === ws.id;
          });
          const completed = wsTasks.filter((t) => t.status === "COMPLETED").length;
          const completionRate = wsTasks.length > 0 ? Math.round((completed / wsTasks.length) * 100) : 0;
          const isOwner = ws.userId === user?.id || (ws.userId as any)?.id === user?.id;

          return (
            <div
              key={ws.id}
              onClick={() => onSelectWorkspaceFilter(ws.id)}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors truncate">
                      {ws.name}
                    </h3>
                  </div>

                  {isOwner && !ws.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ws.id);
                      }}
                      disabled={deletingId === ws.id}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      title="Delete workspace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{wsTasks.length} task{wsTasks.length === 1 ? "" : "s"}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">{completionRate}% complete</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                <span>{isOwner ? "Owner" : "Collaborator"}</span>
                <span className="text-indigo-400 group-hover:underline">View tasks →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
