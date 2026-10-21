import * as React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { 
  Bell, Check, Trash2, Settings, CheckCheck, Moon, Mail
} from "lucide-react";
import { 
  notificationService, 
  type NotificationItem, 
  type NotificationPreferences 
} from "../../services/notificationService";
import { useNavigate } from "react-router-dom";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<"notifications" | "preferences">("notifications");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // Preferences state
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const [prefFeedback, setPrefFeedback] = React.useState<string | null>(null);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await notificationService.listNotifications(
        categoryFilter === "ALL" ? undefined : categoryFilter
      );
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
      if (onUnreadCountChange) onUnreadCountChange(res.unreadCount);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, onUnreadCountChange]);

  const fetchPreferences = React.useCallback(async () => {
    try {
      const prefs = await notificationService.getPreferences();
      setPreferences(prefs);
    } catch (err) {
      console.error("Failed to load preferences:", err);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchNotifications();
      fetchPreferences();
    }
  }, [isOpen, fetchNotifications, fetchPreferences]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (onUnreadCountChange) onUnreadCountChange(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead(
        categoryFilter === "ALL" ? undefined : categoryFilter
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferences) return;
    setSavingPrefs(true);
    setPrefFeedback(null);
    try {
      const updated = await notificationService.updatePreferences(preferences);
      setPreferences(updated);
      setPrefFeedback("Preferences updated successfully!");
      setTimeout(() => setPrefFeedback(null), 3000);
    } catch (err) {
      setPrefFeedback("Failed to save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="relative -mt-4 space-y-4">
        {/* Header Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex items-center gap-2 pb-1 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "notifications"
                  ? "border-indigo-500 text-zinc-100"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notification Center</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("preferences")}
              className={`flex items-center gap-1.5 pb-1 text-sm font-semibold border-b-2 transition-colors ml-4 ${
                activeTab === "preferences"
                  ? "border-indigo-500 text-zinc-100"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Preferences</span>
            </button>
          </div>

          {activeTab === "notifications" && unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* TAB 1: NOTIFICATIONS LIST */}
        {activeTab === "notifications" && (
          <div className="space-y-3">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs pb-1">
              {["ALL", "TASKS", "INVITES", "FEEDBACK", "VERIFICATION", "REMINDERS"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                    categoryFilter === cat
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {cat === "ALL" && "All"}
                  {cat === "TASKS" && "Tasks"}
                  {cat === "INVITES" && "Invites"}
                  {cat === "FEEDBACK" && "Feedback"}
                  {cat === "VERIFICATION" && "Verification"}
                  {cat === "REMINDERS" && "Reminders"}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-zinc-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 space-y-1.5 rounded-xl bg-zinc-900/40 border border-zinc-800">
                <Bell className="w-8 h-8 mx-auto text-zinc-600 mb-1" />
                <div className="text-sm font-semibold text-zinc-300">You're all caught up!</div>
                <div className="text-xs text-zinc-400">No new notifications in this category.</div>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-800/60">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) handleMarkRead(n.id);
                      if (n.actionUrl) {
                        navigate(n.actionUrl);
                        onClose();
                      }
                    }}
                    className={`p-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      !n.read
                        ? "bg-zinc-900 border border-indigo-500/20 shadow-sm"
                        : "hover:bg-zinc-900/60 opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                        !n.read ? "bg-indigo-500" : "bg-transparent"
                      }`} />

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-100 truncate">
                            {n.title}
                          </span>
                          {n.category && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-zinc-700 text-zinc-400">
                              {n.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-zinc-400 block pt-0.5">
                          {new Date(n.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      {!n.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(n.id);
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(n.id);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-red-400"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PREFERENCES */}
        {activeTab === "preferences" && preferences && (
          <form onSubmit={handleSavePreferences} className="space-y-4">
            {prefFeedback && (
              <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs text-center font-medium">
                {prefFeedback}
              </div>
            )}

            {/* Email notifications master toggle */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>Email Reminders & Notifications</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Receive important accountability alerts and deadline reminders via email.
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) =>
                  setPreferences({ ...preferences, emailNotifications: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-800 border-zinc-700"
              />
            </div>

            {/* Quiet Hours */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Moon className="w-4 h-4 text-amber-400" />
                    <span>Quiet Hours</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Pause email reminders during your designated sleep or focus hours.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.quietHours.enabled}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: { ...preferences.quietHours, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-zinc-800 border-zinc-700"
                />
              </div>

              {preferences.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Start Time</label>
                    <Input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          quietHours: { ...preferences.quietHours, start: e.target.value },
                        })
                      }
                      className="h-8 text-xs bg-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">End Time</label>
                    <Input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          quietHours: { ...preferences.quietHours, end: e.target.value },
                        })
                      }
                      className="h-8 text-xs bg-zinc-950"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reminder timing */}
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-200 block">
                Deadline Reminder Timing
              </label>
              <select
                value={preferences.reminderTiming}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    reminderTiming: e.target.value as any,
                  })
                }
                className="w-full h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              >
                <option value="1_HOUR">1 hour before deadline</option>
                <option value="SAME_DAY">Morning of the due date</option>
                <option value="1_DAY">1 day before deadline (Recommended)</option>
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" loading={savingPrefs}>
                Save Preferences
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
