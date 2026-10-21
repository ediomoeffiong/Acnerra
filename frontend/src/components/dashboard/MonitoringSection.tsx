import * as React from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { 
  Users, MessageSquare, ShieldCheck, Calendar, 
  TrendingUp, Send, Info
} from "lucide-react";
import type { Task } from "../../services/taskService";
import { useNavigate } from "react-router-dom";
import { taskService } from "../../services/taskService";

interface MonitoringSectionProps {
  tasks: Task[];
}

export const MonitoringSection: React.FC<MonitoringSectionProps> = ({
  tasks,
}) => {
  const navigate = useNavigate();
  const [requestingId, setRequestingId] = React.useState<string | null>(null);
  const [requestFeedback, setRequestFeedback] = React.useState<{ id: string; msg: string; error?: boolean } | null>(null);

  const handleQuickProgressRequest = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setRequestingId(taskId);
    setRequestFeedback(null);
    try {
      await taskService.createProgressRequest(taskId, "Could you provide a quick progress update on this goal?");
      setRequestFeedback({ id: taskId, msg: "Progress update requested!" });
    } catch (err: any) {
      setRequestFeedback({
        id: taskId,
        msg: err?.response?.data?.message || "Could not send request.",
        error: true,
      });
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Information Header & Explanatory Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-100">Tasks You Are Monitoring</h2>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-xs">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </Badge>
          </div>
          <p className="text-xs text-zinc-400">
            Goals shared by your accountability partners. You provide encouragement and verification.
          </p>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300/90 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Accountability Role:</strong> You are monitoring these commitments as an accountability partner. The task owner remains solely responsible for completion; your feedback and verification do not overwrite their ownership.
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-200">No monitored tasks yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              When an accountability buddy explicitly shares a commitment with you, it will appear here for you to support and encourage them.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tasks.map((task) => {
            const ownerObj = typeof task.ownerId === "object" ? task.ownerId : (typeof task.creatorId === "object" ? task.creatorId : null);
            const ownerName = ownerObj?.name || ownerObj?.username || "Partner";
            const ownerUsername = ownerObj?.username || "partner";
            const isCompleted = task.status === "COMPLETED";
            const isOverdue = task.isOverdue && !isCompleted;
            const progress = task.progress ?? (isCompleted ? 100 : 0);
            const needsVerification = task.verificationRequired && task.verificationStatus === "PENDING";

            return (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
              >
                {/* Header: Owner identity & status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Owner avatar & name */}
                    <div className="flex items-center gap-2 min-w-0">
                      {ownerObj?.image ? (
                        <img
                          src={ownerObj.image}
                          alt={ownerName}
                          className="w-6 h-6 rounded-full object-cover border border-zinc-700"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] flex items-center justify-center border border-purple-500/30">
                          {ownerName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-zinc-200 truncate block">
                          {ownerName}
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">
                          @{ownerUsername}
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 px-2 ${
                        isCompleted
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          : isOverdue
                          ? "border-red-500/30 text-red-400 bg-red-500/10"
                          : "border-zinc-700 text-zinc-400"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-purple-400 transition-colors line-clamp-1">
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
                      <TrendingUp className="w-3 h-3 text-purple-400" />
                      <span>Owner's Progress</span>
                    </span>
                    <span className="font-semibold text-zinc-300">{progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted ? "bg-emerald-500" : "bg-purple-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Verification alert if assigned */}
                {needsVerification && (
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center justify-between">
                    <span className="flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Ready for your verification</span>
                    </span>
                    <span className="text-[10px] underline">Review →</span>
                  </div>
                )}

                {/* Feedback message if triggered */}
                {requestFeedback?.id === task.id && (
                  <div className={`p-1.5 rounded text-[11px] text-center ${
                    requestFeedback.error ? "bg-red-950/40 text-red-400" : "bg-emerald-950/40 text-emerald-300"
                  }`}>
                    {requestFeedback.msg}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  {task.dueDate ? (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500">No deadline</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleQuickProgressRequest(e, task.id)}
                      loading={requestingId === task.id}
                      className="text-xs h-7 px-2 border-zinc-700/60 text-zinc-300"
                      title="Request a progress update"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      <span>Ask Update</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/tasks/${task.id}`);
                      }}
                      className="text-xs h-7 px-2.5 bg-purple-600 hover:bg-purple-500 border-purple-500/30"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      <span>Feedback</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
