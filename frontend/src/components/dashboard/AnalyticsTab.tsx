import * as React from "react";
import { BarChart3, Users } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { analyticsService, type AnalyticsData, type AnalyticsRange } from "../../services/analyticsService";

export const AnalyticsTab: React.FC = () => {
  const [range, setRange] = React.useState<AnalyticsRange>("7d");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<AnalyticsData | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getAnalytics(
        range,
        range === "custom" ? customStart : undefined,
        range === "custom" ? customEnd : undefined
      );
      setData(res);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = data?.metrics;
  const partnerInsights = data?.partnerInsights;

  // Process activity by day for chart
  const activityDays = React.useMemo(() => {
    if (!data?.activityByDay) return [];
    return Object.entries(data.activityByDay).map(([date, val]) => {
      const checkIns = typeof val === "number" ? val : val?.checkIns || 0;
      const completions = typeof val === "object" ? val?.completions || 0 : 0;
      return {
        date,
        label: new Date(date).toLocaleDateString([], { month: "short", day: "numeric" }),
        checkIns,
        completions,
        total: checkIns + completions,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  const maxActivity = Math.max(1, ...activityDays.map((d) => d.total));

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Productivity & Accountability Insights
          </h2>
          <p className="text-xs text-zinc-400">
            Real metrics derived from your commitments, check-ins, and verified milestones.
          </p>
        </div>

        {/* Range Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {(["7d", "30d", "90d", "custom"] as AnalyticsRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              {r === "7d" && "Last 7 Days"}
              {r === "30d" && "Last 30 Days"}
              {r === "90d" && "Last 90 Days"}
              {r === "custom" && "Custom Range"}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Range Picker if active */}
      {range === "custom" && (
        <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">From:</span>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 text-xs bg-zinc-950"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">To:</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 text-xs bg-zinc-950"
            />
          </div>
          <Button size="sm" onClick={loadData} className="h-8 text-xs">
            Apply Date Range
          </Button>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-zinc-500 text-sm">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading personal productivity metrics...
        </div>
      ) : !metrics ? (
        <div className="p-12 text-center text-zinc-500 text-sm rounded-xl bg-zinc-900 border border-zinc-800">
          No analytics data available for this range.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400 font-medium">Task Completion Rate</div>
              <div className="text-2xl font-bold text-emerald-400">{metrics.completionRate}%</div>
              <div className="text-[11px] text-zinc-400">
                {metrics.completedTasks} of {metrics.totalTasks} completed
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400 font-medium">Check-In Consistency</div>
              <div className="text-2xl font-bold text-indigo-400">{metrics.checkInConsistency}%</div>
              <div className="text-[11px] text-zinc-400">
                {metrics.totalCheckIns} progress updates logged
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400 font-medium">Milestones Reached</div>
              <div className="text-2xl font-bold text-amber-400">
                {metrics.milestones?.rate ?? 0}%
              </div>
              <div className="text-[11px] text-zinc-400">
                {metrics.milestones?.completed ?? 0} of {metrics.milestones?.total ?? 0} milestones
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400 font-medium">Recurring Adherence</div>
              <div className="text-2xl font-bold text-purple-400">
                {metrics.recurringAdherence ?? 100}%
              </div>
              <div className="text-[11px] text-zinc-400">Recurring task follow-through</div>
            </div>
          </div>

          {/* Activity Over Time Chart */}
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-200">Daily Momentum & Check-Ins</h3>
                <p className="text-xs text-zinc-400">Frequency of progress updates and task completions</p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-zinc-400">Check-ins</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-zinc-400">Completions</span>
                </span>
              </div>
            </div>

            {activityDays.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-zinc-500">
                No activity recorded in this time window.
              </div>
            ) : (
              <div className="h-48 flex items-end gap-1.5 sm:gap-3 pt-6 px-1 border-b border-zinc-800 pb-2 overflow-x-auto">
                {activityDays.map((day) => {
                  const checkInHeight = Math.round((day.checkIns / maxActivity) * 120);
                  const completionHeight = Math.round((day.completions / maxActivity) * 120);

                  return (
                    <div
                      key={day.date}
                      className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 group"
                    >
                      {/* Bar stack */}
                      <div className="w-full flex flex-col items-center justify-end h-32 gap-0.5">
                        {day.completions > 0 && (
                          <div
                            style={{ height: `${Math.max(6, completionHeight)}px` }}
                            className="w-full bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-400"
                            title={`${day.completions} completions on ${day.label}`}
                          />
                        )}
                        {day.checkIns > 0 && (
                          <div
                            style={{ height: `${Math.max(6, checkInHeight)}px` }}
                            className="w-full bg-indigo-500 rounded-t transition-all group-hover:bg-indigo-400"
                            title={`${day.checkIns} check-ins on ${day.label}`}
                          />
                        )}
                        {day.total === 0 && (
                          <div className="w-full h-1 bg-zinc-800 rounded" />
                        )}
                      </div>

                      {/* Day Label */}
                      <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 truncate">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breakdown Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Completed vs Overdue Breakdown */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold text-zinc-200">Commitment Health</h3>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <span className="text-emerald-400 font-medium">Completed on Schedule</span>
                    <span>{metrics.completedTasks}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${metrics.completionRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <span className="text-red-400 font-medium">Currently Overdue</span>
                    <span>{metrics.overdueTasks}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-red-500 h-full rounded-full"
                      style={{
                        width: `${metrics.totalTasks > 0 ? Math.round((metrics.overdueTasks / metrics.totalTasks) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Check-in breakdown */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold text-zinc-200">Progress Update Statuses</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="text-lg font-bold text-emerald-400">{metrics.completedCheckIns}</div>
                  <div className="text-[10px] text-zinc-400">Completed</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="text-lg font-bold text-indigo-400">{metrics.inProgressCheckIns}</div>
                  <div className="text-[10px] text-zinc-400">In Progress</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <div className="text-lg font-bold text-amber-400">{metrics.missedCheckIns}</div>
                  <div className="text-[10px] text-zinc-400">Missed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Partner Insights Section (Strictly Separated from Personal Productivity) */}
          <div className="p-5 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Accountability Partner Insights
                </h3>
                <p className="text-xs text-zinc-400">
                  Your monitoring contributions. (Never mixed with your personal task scores)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-xs text-zinc-400">Tasks Monitored</div>
                <div className="text-xl font-bold text-purple-300">
                  {partnerInsights?.monitoredTasksCount ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-xs text-zinc-400">Feedback Shared</div>
                <div className="text-xl font-bold text-indigo-300">
                  {partnerInsights?.feedbackGivenCount ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-xs text-zinc-400">Pending Verifications</div>
                <div className="text-xl font-bold text-amber-300">
                  {partnerInsights?.pendingVerificationsCount ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-xs text-zinc-400">Progress Requests Sent</div>
                <div className="text-xl font-bold text-zinc-200">
                  {partnerInsights?.pendingProgressRequestsCount ?? 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
