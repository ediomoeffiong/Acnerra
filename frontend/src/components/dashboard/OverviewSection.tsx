import * as React from "react";
import { Badge } from "../ui/Badge";
import { 
  Calendar, CheckCircle2, AlertTriangle, Target, Flame, 
  Award, Users, ArrowRight
} from "lucide-react";
import type { DashboardStats, AchievementItem } from "../../services/taskService";

interface OverviewSectionProps {
  stats: DashboardStats;
  achievements?: AchievementItem[];
  onSelectTab: (tab: string) => void;
  onFilterOverdue?: () => void;
  onFilterDueToday?: () => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  stats,
  achievements = [],
  onSelectTab,
  onFilterOverdue,
  onFilterDueToday,
}) => {
  const activeCount = (stats.inProgressTasks || 0) + (stats.pendingTasks || 0);
  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Due Today */}
        <div 
          onClick={onFilterDueToday}
          className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Due Today</span>
            <Calendar className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">{stats.dueTodayTasks || 0}</div>
          <div className="text-[10px] text-zinc-400 mt-1">Today's focus</div>
        </div>

        {/* Active Tasks */}
        <div 
          onClick={() => onSelectTab("myTasks")}
          className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Active</span>
            <Target className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">{activeCount}</div>
          <div className="text-[10px] text-zinc-400 mt-1">In progress & pending</div>
        </div>

        {/* Overdue */}
        <div 
          onClick={onFilterOverdue}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
            stats.overdueTasks > 0
              ? "bg-red-950/20 border-red-500/30 hover:border-red-500/50"
              : "bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-700"
          }`}
        >
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className={`text-[11px] font-medium uppercase tracking-wider ${stats.overdueTasks > 0 ? "text-red-400 font-semibold" : ""}`}>
              Overdue
            </span>
            <AlertTriangle className={`w-4 h-4 group-hover:scale-110 transition-transform ${stats.overdueTasks > 0 ? "text-red-400 animate-pulse" : "text-zinc-500"}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.overdueTasks > 0 ? "text-red-400" : "text-zinc-100"}`}>
            {stats.overdueTasks}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">Needs rescheduling</div>
        </div>

        {/* Completed */}
        <div 
          onClick={() => onSelectTab("myTasks")}
          className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">{stats.completedTasks}</div>
          <div className="text-[10px] text-emerald-400 font-medium mt-1">{completionRate}% finish rate</div>
        </div>

        {/* Consistency Streak */}
        <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all group">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Streak</span>
            <Flame className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.currentStreak || 0}d</div>
          <div className="text-[10px] text-zinc-400 mt-1">Best: {stats.longestStreak || 0} days</div>
        </div>

        {/* Monitored Tasks */}
        <div 
          onClick={() => onSelectTab("monitoring")}
          className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-zinc-400 mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider">Monitoring</span>
            <Users className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">{stats.monitoringTasks || 0}</div>
          <div className="text-[10px] text-zinc-400 mt-1">Partner commitments</div>
        </div>
      </div>

      {/* Recent Achievements Showcase if any */}
      {achievements.length > 0 && (
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-semibold text-zinc-200">Unlocked Achievements:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {achievements.slice(-3).map((ach) => (
                <Badge 
                  key={ach.id} 
                  variant="outline" 
                  className="bg-indigo-500/10 border-indigo-500/20 text-indigo-300 text-[11px] py-0.5"
                  title={ach.description}
                >
                  🏆 {ach.name}
                </Badge>
              ))}
            </div>
          </div>

          <button 
            onClick={() => onSelectTab("analytics")}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium ml-auto"
          >
            <span>View personal insights</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
