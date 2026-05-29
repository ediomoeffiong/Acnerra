import * as React from "react";
import { LayoutDashboard, BarChart3, Users, User, LogOut, X, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  onLogout,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "partners", label: "Partners", icon: Users },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-45 flex w-64 flex-col border-r border-zinc-900 bg-zinc-950 px-4 py-6 transition-transform duration-300 transform lg:static lg:translate-x-0",
          {
            "translate-x-0": isOpen,
            "-translate-x-full": !isOpen,
          }
        )}
      >
        {/* Brand / Logo */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="text-xl font-bold tracking-tighter bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Acnerra
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-zinc-200 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "dashboard") {
                    navigate("/dashboard", { state: { activeTab: "dashboard" } });
                  } else if (item.id === "analytics") {
                    navigate("/dashboard", { state: { activeTab: "analytics" } });
                  } else if (item.id === "partners") {
                    navigate("/dashboard", { state: { activeTab: "partners" } });
                  } else if (item.id === "profile" && user) {
                    navigate(`/profile/${user.username}`);
                  }
                  setActiveTab(item.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700",
                  {
                    "bg-zinc-900 text-zinc-50 shadow-sm border border-zinc-800/80": isActive,
                    "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40": !isActive,
                  }
                )}
              >
                <Icon className={cn("h-4 w-4", { "text-indigo-400": isActive })} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="border-t border-zinc-900 pt-4 space-y-2">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400/90 hover:text-red-400 hover:bg-red-950/20 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export { Sidebar };
export { Menu };
