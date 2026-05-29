import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/layouts/AppLayout";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { EditProfileModal } from "../components/profile/EditProfileModal";
import api from "../services/api";
import { 
  Award, Flame, CheckCircle2, User, Calendar, Edit3, ArrowLeft, Clock,
  ChevronRight, Sparkles, Compass
} from "lucide-react";

interface ProfileUserData {
  id: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  createdAt: string;
}

interface ProfileStats {
  completedTasks: number;
  totalTasks: number;
  streakDays: number;
  consistencyRank: string;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [profileUser, setProfileUser] = React.useState<ProfileUserData | null>(null);
  const [stats, setStats] = React.useState<ProfileStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  const isOwnProfile = currentUser?.username?.toLowerCase() === username?.toLowerCase();

  const fetchProfile = async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/profiles/${username}`);
      setProfileUser(response.data.user);
      setStats(response.data.stats);
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      if (err.response?.status === 404) {
        setError("We couldn't find the profile you were looking for.");
      } else {
        setError("An error occurred while fetching the profile details.");
      }
    } finally {
      if (!background) setLoading(false);
    }
  };

  React.useEffect(() => {
    if (username) {
      fetchProfile();
      
      const interval = setInterval(() => {
        fetchProfile(true); // background load every 5 seconds
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [username]);

  // Handler for navigation from sidebar
  const handleTabChange = (tab: string) => {
    if (tab === "dashboard") {
      navigate("/dashboard");
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <AppLayout activeTab="profile" setActiveTab={handleTabChange}>
      
      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={fetchProfile}
        />
      )}

      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Navigation Breadcrumb back to Dashboard */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </button>
          <ChevronRight className="h-3 w-3 text-zinc-800" />
          <span className="text-xs text-zinc-300 font-semibold">
            {loading ? "Loading..." : `@${profileUser?.username}`}
          </span>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="space-y-6">
            <Card className="p-8 border-zinc-900 bg-zinc-950/40">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <Skeleton className="h-24 w-24 rounded-xl shrink-0" />
                <div className="space-y-3 flex-1 w-full">
                  <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
                  <Skeleton className="h-4 w-32 mx-auto sm:mx-0" />
                  <Skeleton className="h-16 w-full mt-4" />
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>
        ) : error ? (
          /* ERROR STATE */
          <Card className="p-12 border-zinc-900 bg-zinc-950/20 text-center flex flex-col items-center justify-center">
            <div className="h-14 w-14 rounded-xl bg-zinc-950 border border-zinc-900 text-indigo-400 flex items-center justify-center mb-4 shadow-inner">
              <Compass className="h-6 w-6 text-indigo-400/80" />
            </div>
            <h2 className="text-lg font-bold text-zinc-200 tracking-tight">Profile Not Found</h2>
            <p className="text-sm text-zinc-500 max-w-sm mt-2 leading-relaxed">
              {error} Please check the username spelling or return to your dashboard.
            </p>
            <Button onClick={() => navigate("/dashboard")} variant="secondary" className="mt-6 font-semibold">
              Return to Workspace
            </Button>
          </Card>
        ) : profileUser ? (
          /* SUCCESS STATE */
          <div className="space-y-8 animate-fade-in">
            
            {/* Header Details Card */}
            <Card className="p-6 md:p-8 border-zinc-900 bg-zinc-950/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[90px] rounded-full pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                
                {/* User Avatar with dynamic fallback */}
                <div className="relative group">
                  {profileUser.image ? (
                    <img 
                      src={profileUser.image} 
                      alt={profileUser.name || profileUser.username}
                      className="h-24 w-24 rounded-xl object-cover border border-zinc-800 bg-zinc-900 shadow-xl group-hover:border-zinc-700 transition-all duration-300 shrink-0" 
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-xl bg-zinc-900 border border-zinc-800 text-4xl font-black text-indigo-400 flex items-center justify-center shadow-xl shadow-black/40 group-hover:border-indigo-500/30 transition-all duration-300 shrink-0">
                      {profileUser.name ? profileUser.name[0].toUpperCase() : profileUser.username[0].toUpperCase()}
                    </div>
                  )}
                  {isOwnProfile && (
                    <button 
                      onClick={() => setIsEditModalOpen(true)}
                      className="absolute -bottom-2 -right-2 h-7 w-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-950/50 text-zinc-100 transition-all active:scale-95"
                      title="Edit avatar"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Profile text and CTA */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold text-zinc-50 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                        {profileUser.name || "Anonymous Creator"}
                        {isOwnProfile && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                            You
                          </span>
                        )}
                      </h1>
                      <p className="text-sm text-zinc-500 font-medium">@{profileUser.username}</p>
                    </div>

                    {isOwnProfile ? (
                      <Button 
                        onClick={() => setIsEditModalOpen(true)} 
                        variant="outline" 
                        size="sm" 
                        className="h-9 font-semibold text-xs gap-1.5 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-zinc-400" /> Edit Profile
                      </Button>
                    ) : (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-9 font-semibold text-xs gap-1.5"
                        onClick={() => {
                          // Simple mock follow or add partner action
                          alert(`Accountability invitation requested for @${profileUser.username}!`);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Track Together
                      </Button>
                    )}
                  </div>

                  {/* Optional Bio with elegant fallback */}
                  {profileUser.bio ? (
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium pt-2 max-w-2xl">
                      {profileUser.bio}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-600 italic pt-2 flex items-center justify-center sm:justify-start gap-1">
                      <User className="h-3.5 w-3.5" /> No bio details documented yet.
                    </p>
                  )}

                  {/* Joined Date */}
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] text-zinc-500 font-semibold pt-1">
                    <Calendar className="h-3.5 w-3.5" /> 
                    <span>Joined {formatDate(profileUser.createdAt)}</span>
                  </div>
                </div>

              </div>
            </Card>

            {/* Profile Statistics Grid */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-zinc-200 tracking-tight flex items-center gap-1.5">
                <Award className="h-4.5 w-4.5 text-indigo-400" />
                Performance Metrics
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <Card className="p-5 border-zinc-900 bg-zinc-950/40 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Consistency Rank</span>
                      <span className="text-base font-bold text-zinc-100 mt-1 block">
                        {stats?.consistencyRank || "Active Creator"}
                      </span>
                    </div>
                    <Award className="h-6 w-6 text-indigo-400 shrink-0" />
                  </div>
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full mt-4 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ width: stats?.completedTasks && stats.completedTasks >= 5 ? '100%' : '50%' }}
                    />
                  </div>
                </Card>

                <Card className="p-5 border-zinc-900 bg-zinc-950/40 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Completed Targets</span>
                      <span className="text-base font-bold text-zinc-100 mt-1 block">
                        {stats?.completedTasks} / {stats?.totalTasks}
                      </span>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-4 font-semibold">
                    Verified milestone check-ins
                  </p>
                </Card>

                <Card className="p-5 border-zinc-900 bg-zinc-950/40 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Streak Record</span>
                      <span className="text-base font-bold text-zinc-100 mt-1 block">
                        {stats?.streakDays} days
                      </span>
                    </div>
                    <Flame className="h-6 w-6 text-amber-500 shrink-0" />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-4 font-semibold">
                    Consecutive accountability check-ins
                  </p>
                </Card>

              </div>
            </div>

            {/* Profile milestones / accountability feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-zinc-300 tracking-tight flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-purple-400" />
                  Active Milestones
                </h3>

                {stats?.totalTasks === 0 ? (
                  <div className="p-10 border border-zinc-900 bg-zinc-950/20 rounded-xl text-center">
                    <Clock className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-zinc-400">No active milestones tracked.</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">When goals are built, they will list here.</p>
                  </div>
                ) : (
                  <Card className="p-5 border-zinc-900 bg-zinc-950/40">
                    <p className="text-xs text-zinc-400 font-medium">
                      This user has successfully registered and logged {stats?.totalTasks} goals, completing {stats?.completedTasks} of them! Keep up the incredible accountability momentum.
                    </p>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-zinc-300 tracking-tight flex items-center gap-1.5">
                  <User className="h-4 w-4 text-cyan-400" />
                  Shared Accountability
                </h3>

                <Card className="p-4 border-zinc-900 bg-zinc-950/40 text-center">
                  <p className="text-xs text-zinc-500 font-semibold">
                    Partners are linked directly via task invites. Create a milestone to add accountability partners.
                  </p>
                </Card>
              </div>

            </div>

          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
