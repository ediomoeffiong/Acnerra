import * as React from "react";
import { Button } from "../ui/Button";
import { 
  Flame, Plus, Bell, HelpCircle, Award
} from "lucide-react";
import type { UserGamification } from "../../services/taskService";

interface DashboardHeaderProps {
  user: any;
  gamification?: UserGamification;
  unreadNotificationsCount: number;
  onOpenNewTask: () => void;
  onOpenNotifications: () => void;
  onOpenTour: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  gamification,
  unreadNotificationsCount,
  onOpenNewTask,
  onOpenNotifications,
  onOpenTour,
}) => {
  // Determine greeting based on local hour
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const level = gamification?.level || user?.level || 1;
  const xp = gamification?.xp ?? user?.xp ?? 0;
  const streak = gamification?.currentStreak ?? user?.currentStreak ?? 0;

  // XP progress inside current level: Level L requires (L - 1)^2 * 100 XP, next level requires L^2 * 100 XP
  const currentLevelFloorXP = Math.pow(level - 1, 2) * 100;
  const nextLevelCeilXP = Math.pow(level, 2) * 100;
  const levelSpan = Math.max(1, nextLevelCeilXP - currentLevelFloorXP);
  const xpInLevel = Math.max(0, xp - currentLevelFloorXP);
  const xpPercent = Math.min(100, Math.round((xpInLevel / levelSpan) * 100));

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            {greeting}, {user?.name || user?.username || "there"}
          </h1>
          <span className="inline-block animate-pulse">✨</span>
        </div>
        <p className="text-xs sm:text-sm text-zinc-400">
          Track commitments, review partner updates, and maintain consistency.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Streak Pill */}
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold shadow-sm"
          title={`Current consistency streak: ${streak} days`}
        >
          <Flame className="w-4 h-4 text-amber-400 fill-amber-400/20" />
          <span>{streak} day{streak === 1 ? "" : "s"} streak</span>
        </div>

        {/* Level & XP Pill */}
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold shadow-sm"
          title={`Level ${level} (${xp} total XP, ${nextLevelCeilXP - xp} XP to Level ${level + 1})`}
        >
          <Award className="w-4 h-4 text-indigo-400" />
          <span>Lvl {level}</span>
          <div className="w-12 bg-zinc-800 rounded-full h-1.5 overflow-hidden ml-1">
            <div 
              className="bg-indigo-400 h-full rounded-full transition-all"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-indigo-400/80">{xp} XP</span>
        </div>

        {/* Notifications Button */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
          aria-label="View notifications"
          title="Notifications & reminders"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-md animate-pulse">
              {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Tour / Help Button */}
        <button
          onClick={onOpenTour}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Open guided onboarding tour"
          title="Help & Tour"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* New Task Button */}
        <Button 
          variant="primary" 
          size="sm" 
          onClick={onOpenNewTask}
          className="gap-1.5 shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Commitment</span>
        </Button>
      </div>
    </div>
  );
};
