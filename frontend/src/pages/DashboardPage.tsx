import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/layouts/AppLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { 
  Plus, CheckCircle2, Circle, Clock, Trash2, UserPlus, 
  ArrowUpCircle, Flame, Calendar, Award 
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  dueDate: string;
  checkInCount: number;
}

interface Buddy {
  id: string;
  name: string;
  username: string;
  status: "active" | "pending";
}

interface Activity {
  id: string;
  text: string;
  time: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("dashboard");

  // State loaded from LocalStorage
  const [tasks, setTasks] = React.useState<Task[]>(() => {
    const saved = localStorage.getItem("acnerra_tasks");
    return saved ? JSON.parse(saved) : [
      {
        id: "1",
        title: "Design Acnerra Figma Workspace",
        description: "Draft structural layouts, card spacing system, and visual palettes.",
        status: "in_progress",
        priority: "high",
        dueDate: "2026-05-20",
        checkInCount: 3,
      },
      {
        id: "2",
        title: "Setup Express Validation Schemas",
        description: "Integrate Zod validator middleware into backend router entries.",
        status: "todo",
        priority: "medium",
        dueDate: "2026-05-24",
        checkInCount: 0,
      },
      {
        id: "3",
        title: "Finalize Dark Mode Scrollbars",
        description: "Make layout elements fit neatly on standard and mobile sizes.",
        status: "done",
        priority: "low",
        dueDate: "2026-05-18",
        checkInCount: 1,
      }
    ];
  });

  const [buddies, setBuddies] = React.useState<Buddy[]>(() => {
    const saved = localStorage.getItem("acnerra_buddies");
    return saved ? JSON.parse(saved) : [
      { id: "1", name: "Alex Mercer", username: "alexm", status: "active" },
      { id: "2", name: "Sarah Connor", username: "sarahc", status: "active" },
      { id: "3", name: "John Doe", username: "johnd", status: "pending" }
    ];
  });

  const [activities, setActivities] = React.useState<Activity[]>(() => {
    const saved = localStorage.getItem("acnerra_activities");
    return saved ? JSON.parse(saved) : [
      { id: "1", text: "You created task 'Design Acnerra Figma Workspace'", time: "2 hours ago" },
      { id: "2", text: "Alex Mercer approved your check-in for 'Dark Mode Scrollbars'", time: "5 hours ago" },
      { id: "3", text: "You sent a buddy request to John Doe", time: "1 day ago" }
    ];
  });

  // Profile Edit States
  const [profileBio, setProfileBio] = React.useState(() => {
    return localStorage.getItem("acnerra_bio") || "Passionate software creator focused on consistent daily targets and collaborative accountability.";
  });

  // Modals Toggles
  const [isTaskModalOpen, setIsTaskModalOpen] = React.useState(false);
  const [isBuddyModalOpen, setIsBuddyModalOpen] = React.useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = React.useState(false);

  // New Forms State
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDesc, setNewTaskDesc] = React.useState("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"high" | "medium" | "low">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = React.useState("");

  const [newBuddyUsername, setNewBuddyUsername] = React.useState("");
  const [newBuddyEmail, setNewBuddyEmail] = React.useState("");

  const [editBioText, setEditBioText] = React.useState(profileBio);

  // Persistence
  React.useEffect(() => {
    localStorage.setItem("acnerra_tasks", JSON.stringify(tasks));
  }, [tasks]);

  React.useEffect(() => {
    localStorage.setItem("acnerra_buddies", JSON.stringify(buddies));
  }, [buddies]);

  React.useEffect(() => {
    localStorage.setItem("acnerra_activities", JSON.stringify(activities));
  }, [activities]);

  // Actions
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      description: newTaskDesc,
      status: "todo",
      priority: newTaskPriority,
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0],
      checkInCount: 0
    };

    setTasks([newTask, ...tasks]);
    setActivities([{ id: Date.now().toString(), text: `You created task '${newTaskTitle}'`, time: "Just now" }, ...activities]);
    
    // Reset Form & Close
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskPriority("medium");
    setNewTaskDueDate("");
    setIsTaskModalOpen(false);
  };

  const handleToggleTaskStatus = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        let nextStatus: "todo" | "in_progress" | "done" = "todo";
        if (t.status === "todo") nextStatus = "in_progress";
        else if (t.status === "in_progress") nextStatus = "done";
        
        // Log activity
        setActivities([{
          id: Date.now().toString(),
          text: `You moved '${t.title}' to ${nextStatus.replace('_', ' ')}`,
          time: "Just now"
        }, ...activities]);

        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string, title: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    setActivities([{ id: Date.now().toString(), text: `You deleted task '${title}'`, time: "Just now" }, ...activities]);
  };

  const handleAddBuddy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuddyUsername.trim()) return;

    const newBuddy: Buddy = {
      id: Date.now().toString(),
      name: newBuddyUsername,
      username: newBuddyUsername.toLowerCase(),
      status: "pending"
    };

    setBuddies([...buddies, newBuddy]);
    setActivities([{ id: Date.now().toString(), text: `You sent a buddy request to ${newBuddyUsername}`, time: "Just now" }, ...activities]);

    setNewBuddyUsername("");
    setNewBuddyEmail("");
    setIsBuddyModalOpen(false);
  };

  const handleSaveBio = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBio(editBioText);
    localStorage.setItem("acnerra_bio", editBioText);
    setIsEditProfileModalOpen(false);
  };

  // Metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "done").length;
  const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
  const activeBuddies = buddies.filter(b => b.status === "active").length;

  return (
    <AppLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "dashboard" ? (
        <div className="space-y-8">
          {/* Welcome Intro Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Your Accountability Space</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Maintain consistency with your partners. Double your daily output velocity.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setIsTaskModalOpen(true)} className="h-9 font-semibold text-xs">
                <Plus className="mr-1.5 h-4 w-4" /> Create Task
              </Button>
              <Button onClick={() => setIsBuddyModalOpen(true)} variant="secondary" className="h-9 font-semibold text-xs">
                <UserPlus className="mr-1.5 h-4 w-4" /> Add Partner
              </Button>
            </div>
          </div>

          {/* SaaS Metrics Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-zinc-950/40 border-zinc-900">
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Total Tasks
                <Clock className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-zinc-100 mt-2">{totalTasks}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Assigned accountability targets</p>
            </Card>

            <Card className="p-4 bg-zinc-950/40 border-zinc-900">
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                In Progress
                <ArrowUpCircle className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-zinc-100 mt-2">{inProgressTasks}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Actively tracking right now</p>
            </Card>

            <Card className="p-4 bg-zinc-950/40 border-zinc-900">
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Completed
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-zinc-100 mt-2">{completedTasks}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Verified partner checkpoints</p>
            </Card>

            <Card className="p-4 bg-zinc-950/40 border-zinc-900">
              <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Partners
                <Flame className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-zinc-100 mt-2">{activeBuddies}</p>
              <p className="text-[10px] text-zinc-500 mt-1">Active buddy trackers linked</p>
            </Card>
          </div>

          {/* Core Content Body - Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Block: Task Tracker Board */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-zinc-200 tracking-tight">Active Work board</h2>
                <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-semibold">
                  {tasks.filter(t => t.status !== "done").length} Remaining
                </Badge>
              </div>

              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-zinc-900 bg-zinc-950/20">
                  <Clock className="h-10 w-10 text-zinc-700 mb-3" />
                  <p className="text-sm font-semibold text-zinc-400">No tasks currently tracked.</p>
                  <p className="text-xs text-zinc-600 mt-1">Create a milestone and assign an accountability buddy to begin.</p>
                  <Button onClick={() => setIsTaskModalOpen(true)} variant="secondary" size="sm" className="mt-4 font-semibold">
                    Create Milestone
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Card key={task.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-zinc-800 transition-all duration-300">
                      <div className="flex items-start gap-3.5">
                        <button
                          onClick={() => handleToggleTaskStatus(task.id)}
                          className="mt-1 flex-shrink-0 text-zinc-500 hover:text-indigo-400 transition-colors focus:outline-none"
                        >
                          {task.status === "done" ? (
                            <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="h-5 w-5 text-purple-400" />
                          ) : (
                            <Circle className="h-5 w-5 text-zinc-700" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold tracking-tight ${task.status === "done" ? "line-through text-zinc-500" : "text-zinc-100"}`}>
                              {task.title}
                            </span>
                            <Badge 
                              variant={
                                task.priority === "high" 
                                  ? "destructive" 
                                  : task.priority === "medium" 
                                  ? "warning" 
                                  : "secondary"
                              }
                              className="text-[9px] uppercase tracking-wider px-1.5 py-0"
                            >
                              {task.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-400/90 mt-1 max-w-lg leading-relaxed">{task.description}</p>
                          <div className="flex items-center gap-4 mt-2.5 text-[10px] text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" /> Due {task.dueDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <Award className="h-3.5 w-3.5 text-indigo-400/80" /> {task.checkInCount} check-ins
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Trash action */}
                      <button
                        onClick={() => handleDeleteTask(task.id, task.title)}
                        className="self-end sm:self-auto rounded-lg p-2 text-zinc-600 hover:text-red-400 hover:bg-red-950/20 transition-all focus:outline-none"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Right Block: Collaboration & Activity Panels */}
            <div className="space-y-6">
              {/* Accountability Partners Box */}
              <div className="space-y-3">
                <h2 className="text-base font-bold text-zinc-200 tracking-tight">Accountability Partners</h2>
                <Card className="p-4 space-y-3.5 border-zinc-900 bg-zinc-950/30">
                  {buddies.map((buddy) => (
                    <div key={buddy.id} className="flex items-center justify-between gap-2 border-b border-zinc-900/50 pb-2.5 last:border-0 last:pb-0">
                      <button
                        onClick={() => navigate(`/profile/${buddy.username}`)}
                        className="flex items-center gap-2 text-left hover:opacity-85 transition-all focus:outline-none group"
                      >
                        <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-center group-hover:border-indigo-500/30 transition-all">
                          {buddy.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-400 transition-colors">{buddy.name}</span>
                          <span className="text-[10px] text-zinc-500">@{buddy.username}</span>
                        </div>
                      </button>
                      <Badge 
                        variant={buddy.status === "active" ? "success" : "warning"}
                        className="text-[9px] px-1.5 py-0 uppercase"
                      >
                        {buddy.status}
                      </Badge>
                    </div>
                  ))}
                  <Button onClick={() => setIsBuddyModalOpen(true)} variant="outline" className="w-full text-xs font-semibold h-8 mt-2">
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> Invite new partner
                  </Button>
                </Card>
              </div>

              {/* Recent Activity Log */}
              <div className="space-y-3">
                <h2 className="text-base font-bold text-zinc-200 tracking-tight">Recent Activity Feed</h2>
                <Card className="p-4 space-y-3.5 border-zinc-900 bg-zinc-950/30">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 text-[11px] border-l-2 border-zinc-900 pl-3 py-0.5">
                      <div className="flex-1">
                        <p className="text-zinc-300 leading-relaxed">{act.text}</p>
                        <span className="text-[9px] text-zinc-500 mt-1 block">{act.time}</span>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>

          {/* Modal Overlay: Create Task */}
          <Modal
            isOpen={isTaskModalOpen}
            onClose={() => setIsTaskModalOpen(false)}
            title="Create Accountability Task"
          >
            <form onSubmit={handleCreateTask} className="space-y-4">
              <Input
                id="taskTitle"
                label="Task Title"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Implement Prisma migrations"
              />
              <Input
                id="taskDesc"
                label="Description"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Details about what your partner should inspect..."
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <Input
                  id="taskDueDate"
                  label="Target Date"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsTaskModalOpen(false)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Create Task
                </Button>
              </div>
            </form>
          </Modal>

          {/* Modal Overlay: Add Buddy */}
          <Modal
            isOpen={isBuddyModalOpen}
            onClose={() => setIsBuddyModalOpen(false)}
            title="Invite Accountability Buddy"
          >
            <form onSubmit={handleAddBuddy} className="space-y-4">
              <Input
                id="buddyUsername"
                label="Partner Username"
                required
                value={newBuddyUsername}
                onChange={(e) => setNewBuddyUsername(e.target.value)}
                placeholder="e.g. sarahc"
              />
              <Input
                id="buddyEmail"
                label="Partner Email Address"
                type="email"
                value={newBuddyEmail}
                onChange={(e) => setNewBuddyEmail(e.target.value)}
                placeholder="name@example.com"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsBuddyModalOpen(false)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Send Invitation
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      ) : (
        /* TAB: Profile tab */
        <div className="space-y-8 max-w-3xl mx-auto">
          {/* User Details Grid */}
          <Card className="p-6 border-zinc-900 bg-zinc-950/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              <div className="h-20 w-20 rounded-xl bg-zinc-900 border border-zinc-800 text-3xl font-extrabold text-indigo-400 flex items-center justify-center shadow-lg shadow-black/40 shrink-0">
                {user?.name ? user.name[0].toUpperCase() : user?.username[0].toUpperCase()}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-100 tracking-tight">{user?.name || "Active Creator"}</h1>
                    <p className="text-xs text-zinc-500">@{user?.username || "creator"}</p>
                  </div>
                  <Button onClick={() => { setEditBioText(profileBio); setIsEditProfileModalOpen(true); }} variant="outline" size="sm" className="h-8 font-semibold text-xs">
                    Edit Bio
                  </Button>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed pt-2">{profileBio}</p>
              </div>
            </div>
          </Card>

          {/* Profile statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 border-zinc-900 bg-zinc-950/40 text-center">
              <Award className="mx-auto h-5 w-5 text-indigo-400 mb-2" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Consistency Rank</span>
              <span className="text-lg font-bold text-zinc-100 mt-1 block">Elite Partner</span>
            </Card>
            <Card className="p-4 border-zinc-900 bg-zinc-950/40 text-center">
              <Flame className="mx-auto h-5 w-5 text-amber-500 mb-2" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Streak Record</span>
              <span className="text-lg font-bold text-zinc-100 mt-1 block">14 days</span>
            </Card>
            <Card className="p-4 border-zinc-900 bg-zinc-950/40 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400 mb-2" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Completed Targets</span>
              <span className="text-lg font-bold text-zinc-100 mt-1 block">{completedTasks} tasks</span>
            </Card>
          </div>

          {/* Modal Overlay: Edit Profile Bio */}
          <Modal
            isOpen={isEditProfileModalOpen}
            onClose={() => setIsEditProfileModalOpen(false)}
            title="Edit Profile Bio"
          >
            <form onSubmit={handleSaveBio} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Short Bio</label>
                <textarea
                  value={editBioText}
                  onChange={(e) => setEditBioText(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="Describe your accountabilty goals..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditProfileModalOpen(false)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Bio
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </AppLayout>
  );
}
