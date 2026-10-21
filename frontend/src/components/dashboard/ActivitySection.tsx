import * as React from "react";
import { MessageSquare, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import type { ActivityItem } from "../../services/taskService";
import { useNavigate } from "react-router-dom";

interface ActivitySectionProps {
  activities: ActivityItem[];
}

export const ActivitySection: React.FC<ActivitySectionProps> = ({ activities }) => {
  const navigate = useNavigate();

  if (!activities || activities.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 text-xs">
        No recent activity logged yet. Check-ins and milestone completions will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-200">Recent Accountability Activity</h3>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 divide-y divide-zinc-800/60 overflow-hidden">
        {activities.map((act) => {
          const isCheckIn = act.type === "CHECK_IN";

          return (
            <div
              key={act.id}
              onClick={() => act.taskId && navigate(`/tasks/${act.taskId}`)}
              className="p-3.5 hover:bg-zinc-800/30 transition-colors cursor-pointer flex items-start gap-3 text-xs"
            >
              <div className="w-7 h-7 rounded-lg bg-zinc-800 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700/50">
                {isCheckIn ? (
                  <MessageSquare className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-zinc-200 leading-relaxed font-medium">
                  {act.message}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span>•</span>
                  <span>{new Date(act.timestamp).toLocaleDateString()}</span>
                  {act.taskTitle && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-400 hover:underline truncate">
                        {act.taskTitle}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-1" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
