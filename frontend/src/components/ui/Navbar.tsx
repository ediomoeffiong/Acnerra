import * as React from "react";
import { Bell, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils";

interface NavbarProps {
  activeTab: string;
  onMenuClick: () => void;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  isRead: boolean;
  type: "invite" | "task" | "checkin";
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onMenuClick }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([
    {
      id: "1",
      title: "Buddy Invite Received",
      description: "Alex invited you to their accountability group.",
      time: "2 hours ago",
      isRead: false,
      type: "invite",
    },
    {
      id: "2",
      title: "Task Deadline Approaching",
      description: "Submit task 'Acnerra Backend API' check-in by 5:00 PM.",
      time: "4 hours ago",
      isRead: false,
      type: "task",
    },
    {
      id: "3",
      title: "Buddy Submitted Check-in",
      description: "Sarah updated their check-in for 'UI Design Review'.",
      time: "Yesterday",
      isRead: true,
      type: "checkin",
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  // Close dropdown on click outside
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-6 backdrop-blur-md">
      {/* Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 lg:hidden focus:outline-none"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="text-zinc-500">Acnerra</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-100 capitalize">{activeTab}</span>
        </div>
      </div>

      {/* Notifications & Profile Trigger */}
      <div className="flex items-center gap-4">
        {/* Notification Bell Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative rounded-lg p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors focus:outline-none"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-zinc-950" />
            ) : null}
          </button>

          {/* Dropdown Panel */}
          {isNotifOpen ? (
            <div className="absolute right-0 mt-2.5 w-80 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl animate-fade-in z-50">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-3">
                <span className="text-sm font-semibold text-zinc-200">Notifications</span>
                {unreadCount > 0 ? (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>

              {/* Notification List */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">No notifications yet.</p>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={cn(
                        "group relative rounded-lg p-2.5 transition-colors cursor-pointer border border-transparent",
                        {
                          "bg-zinc-900/40 border-zinc-900/60 hover:bg-zinc-900": notif.isRead,
                          "bg-indigo-950/20 border-indigo-900/20 hover:bg-indigo-950/30": !notif.isRead,
                        }
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn("text-xs font-semibold", {
                            "text-zinc-200": notif.isRead,
                            "text-indigo-400": !notif.isRead,
                          })}
                        >
                          {notif.title}
                        </span>
                        {!notif.isRead ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1" />
                        ) : null}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">{notif.description}</p>
                      <span className="text-[10px] text-zinc-500 mt-2 block">{notif.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* User Badge */}
        <button 
          onClick={() => user && navigate(`/profile/${user.username}`)}
          className="flex items-center gap-2.5 border-l border-zinc-900 pl-4 cursor-pointer hover:opacity-80 transition-all focus:outline-none text-left"
        >
          {user?.image ? (
            <img 
              src={user.image} 
              alt={user.name || user.username} 
              className="h-8 w-8 rounded-lg object-cover border border-zinc-800 bg-zinc-900 shadow"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-100">
              {user?.name ? user.name[0].toUpperCase() : user?.username[0].toUpperCase()}
            </div>
          )}
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-zinc-200 leading-none">
              {user?.name || user?.username}
            </span>
            <span className="text-[10px] text-zinc-500 leading-none mt-1">Active Partner</span>
          </div>
        </button>
      </div>
    </header>
  );
};

export { Navbar };
