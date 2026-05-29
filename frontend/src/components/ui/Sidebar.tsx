import * as React from "react";
import { LayoutDashboard, Folder, BarChart3, Users, User, LogOut, X, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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

  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    return localStorage.getItem("acnerra_sidebar_collapsed") === "true";
  });

  const collapseTimeoutRef = React.useRef<any>(null);

  const startCollapseTimer = React.useCallback(() => {
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    collapseTimeoutRef.current = setTimeout(() => {
      setIsCollapsed(true);
    }, 5700);
  }, []);

  const clearCollapseTimer = React.useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  // Run auto-collapse timer on mount
  React.useEffect(() => {
    startCollapseTimer();
    return () => clearCollapseTimer();
  }, [startCollapseTimer, clearCollapseTimer]);

  const handleMouseEnter = () => {
    clearCollapseTimer();
    setIsCollapsed(false);
  };

  const handleMouseLeave = () => {
    startCollapseTimer();
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("acnerra_sidebar_collapsed", String(next));
      return next;
    });
  };
 
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "workspace", label: "Workspace", icon: Folder },
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
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-45 flex flex-col border-r border-zinc-900 bg-zinc-950 py-6 transition-all duration-350 transform lg:static lg:translate-x-0",
          isCollapsed ? "w-20 px-3" : "w-64 px-4",
          {
            "translate-x-0": isOpen,
            "-translate-x-full": !isOpen,
          }
        )}
      >
        {/* Brand / Logo */}
        <div className={cn("flex items-center mb-8 px-2 justify-between", isCollapsed ? "flex-col gap-3 px-0 justify-center" : "flex-row")}>
          <div className={cn("font-bold tracking-tighter bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-350", isCollapsed ? "text-2xl font-black" : "text-xl")}>
            {isCollapsed ? "A" : "Acnerra"}
          </div>
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex rounded-lg p-1 text-zinc-550 hover:text-zinc-200 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all focus:outline-none"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-550 hover:text-zinc-200 lg:hidden"
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
                  } else if (item.id === "workspace") {
                    navigate("/dashboard", { state: { activeTab: "workspace" } });
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
                  "flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700",
                  isCollapsed ? "justify-center px-0 gap-0" : "justify-start px-3 gap-3",
                  {
                    "bg-zinc-900 text-zinc-50 shadow-sm border border-zinc-800/80": isActive,
                    "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/40": !isActive,
                  }
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={cn("h-4 w-4 shrink-0", { "text-indigo-400": isActive })} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
 
        {/* Footer Actions */}
        <div className="border-t border-zinc-900 pt-4 space-y-2">
          <button
            onClick={onLogout}
            className={cn(
              "flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-red-400/90 hover:text-red-400 hover:bg-red-950/20 transition-all duration-200",
              isCollapsed ? "justify-center px-0 gap-0" : "justify-start px-3 gap-3"
            )}
            title={isCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
 
export { Sidebar };
export { Menu };
