import * as React from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { 
  Users, UserPlus, Search, Trash2, Clock
} from "lucide-react";
import { partnersService } from "../../services/partnersService";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export const PartnersTab: React.FC = () => {
  const { user } = useAuth();
  const [partnerRelations, setPartnerRelations] = React.useState<any[]>([]);
  const [partnerSearchQuery, setPartnerSearchQuery] = React.useState("");
  const [searchedProfiles, setSearchedProfiles] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [invitePartnerMode, setInvitePartnerMode] = React.useState<"MUTUAL" | "SINGLE">("MUTUAL");
  const [partnerFeedback, setPartnerFeedback] = React.useState<string | null>(null);
  const [partnerError, setPartnerError] = React.useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const loadPartnerRelations = React.useCallback(async () => {
    try {
      const data = await partnersService.getPartners();
      setPartnerRelations(data);
    } catch (err) {
      console.error("Failed to load partners:", err);
    }
  }, []);

  React.useEffect(() => {
    loadPartnerRelations();
  }, [loadPartnerRelations]);

  const handlePartnerSearch = async (query: string) => {
    setPartnerSearchQuery(query);
    if (!query.trim()) {
      setSearchedProfiles([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get(`/profiles?query=${encodeURIComponent(query.trim())}`);
      setSearchedProfiles(res.data.users || []);
    } catch {
      setSearchedProfiles([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvite = async (receiverId: string) => {
    setActionLoadingId(receiverId);
    setPartnerFeedback(null);
    setPartnerError(null);
    try {
      await partnersService.sendInvite(receiverId, invitePartnerMode);
      setPartnerFeedback("Invitation sent successfully!");
      setPartnerSearchQuery("");
      setSearchedProfiles([]);
      await loadPartnerRelations();
    } catch (err: any) {
      setPartnerError(err?.response?.data?.message || "Failed to send partner invite.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptInvite = async (relationId: string) => {
    setActionLoadingId(relationId);
    try {
      await partnersService.acceptInvite(relationId);
      await loadPartnerRelations();
    } catch (err: any) {
      setPartnerError(err?.response?.data?.message || "Failed to accept invite.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineInvite = async (relationId: string) => {
    setActionLoadingId(relationId);
    try {
      await partnersService.declineInvite(relationId);
      await loadPartnerRelations();
    } catch (err: any) {
      setPartnerError(err?.response?.data?.message || "Failed to decline invite.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemovePartner = async (partnerId: string) => {
    if (!window.confirm("Are you sure you want to end this accountability partnership?")) return;
    setActionLoadingId(partnerId);
    try {
      await partnersService.removePartner(partnerId);
      await loadPartnerRelations();
    } catch (err: any) {
      setPartnerError(err?.response?.data?.message || "Failed to remove partner.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const acceptedMutual = partnerRelations.filter(
    (r) => r.status === "ACCEPTED" && r.mode === "MUTUAL"
  );
  const acceptedSingle = partnerRelations.filter(
    (r) => r.status === "ACCEPTED" && r.mode === "SINGLE"
  );
  const incomingPending = partnerRelations.filter(
    (r) => r.status === "PENDING" && (r.receiverId?.id === user?.id || r.receiverId === user?.id)
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Accountability Partners
        </h1>
        <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
          Manage your accountability network. Connect with Mutual or Single partners to monitor commitments.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Link / Search Partners */}
        <div className="md:col-span-1 space-y-4">
          <Card className="p-4 border-zinc-800 bg-zinc-900/60 shadow-md space-y-3">
            <h3 className="text-xs font-bold text-zinc-200 tracking-wider uppercase flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-indigo-400" />
              <span>Invite New Partner</span>
            </h3>

            {/* Mode Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Partnership Type
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setInvitePartnerMode("MUTUAL")}
                  className={`py-1 text-xs font-semibold rounded transition-colors ${
                    invitePartnerMode === "MUTUAL"
                      ? "bg-zinc-800 text-indigo-400"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Mutual ({acceptedMutual.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInvitePartnerMode("SINGLE")}
                  className={`py-1 text-xs font-semibold rounded transition-colors ${
                    invitePartnerMode === "SINGLE"
                      ? "bg-zinc-800 text-indigo-400"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Single ({acceptedSingle.length})
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
              <span className="font-semibold text-zinc-300 block">
                {invitePartnerMode === "MUTUAL" ? "Mutual Partnership:" : "Single Partnership:"}
              </span>
              <p className="leading-relaxed">
                {invitePartnerMode === "MUTUAL"
                  ? "Both of you can monitor each other's explicitly shared commitments and exchange feedback."
                  : "Directional: the invited buddy monitors your explicitly shared tasks."}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Input
                placeholder="Search username or email..."
                value={partnerSearchQuery}
                onChange={(e) => handlePartnerSearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-zinc-950"
              />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>

            {partnerFeedback && (
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs">
                {partnerFeedback}
              </div>
            )}
            {partnerError && (
              <div className="p-2 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-xs">
                {partnerError}
              </div>
            )}

            {/* Search Results */}
            {isSearching ? (
              <div className="text-center py-4 text-xs text-zinc-500">Searching profiles...</div>
            ) : (
              searchedProfiles.length > 0 && (
                <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto divide-y divide-zinc-800">
                  {searchedProfiles
                    .filter((p) => p.id !== user?.id)
                    .map((profile) => (
                      <div
                        key={profile.id}
                        className="p-2 flex items-center justify-between gap-2 pt-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-zinc-200 truncate block">
                            {profile.name || profile.username}
                          </span>
                          <span className="text-[10px] text-zinc-500 truncate block">
                            @{profile.username}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSendInvite(profile.id)}
                          loading={actionLoadingId === profile.id}
                          className="h-7 text-xs px-2.5"
                        >
                          Invite
                        </Button>
                      </div>
                    ))}
                </div>
              )
            )}
          </Card>
        </div>

        {/* Right Column: Accepted & Pending Partnerships */}
        <div className="md:col-span-2 space-y-4">
          {/* Pending Invitations received */}
          {incomingPending.length > 0 && (
            <Card className="p-4 border-amber-500/30 bg-amber-950/10 space-y-3">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Pending Partner Requests ({incomingPending.length})</span>
              </h3>
              <div className="space-y-2">
                {incomingPending.map((rel) => {
                  const sender = rel.senderId;
                  return (
                    <div
                      key={rel.id}
                      className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">
                          {sender?.name || sender?.username || "A user"}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Sent you a {rel.mode.toLowerCase()} accountability invitation
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineInvite(rel.id)}
                          loading={actionLoadingId === rel.id}
                          className="h-7 text-xs px-2"
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleAcceptInvite(rel.id)}
                          loading={actionLoadingId === rel.id}
                          className="h-7 text-xs px-2.5"
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Active Partners List */}
          <Card className="p-4 border-zinc-800 bg-zinc-900/60 space-y-3">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Active Accountability Partners ({acceptedMutual.length + acceptedSingle.length})</span>
            </h3>

            {acceptedMutual.length === 0 && acceptedSingle.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                You have no active accountability partners yet. Invite friends or teammates using the form on the left.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...acceptedMutual, ...acceptedSingle].map((rel) => {
                  const partner =
                    rel.senderId?.id === user?.id || rel.senderId === user?.id
                      ? rel.receiverId
                      : rel.senderId;
                  const partnerName = partner?.name || partner?.username || "Partner";

                  return (
                    <div
                      key={rel.id}
                      className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-200 truncate">
                            {partnerName}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] py-0 px-1.5 ${
                              rel.mode === "MUTUAL"
                                ? "border-indigo-500/30 text-indigo-400"
                                : "border-emerald-500/30 text-emerald-400"
                            }`}
                          >
                            {rel.mode}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-zinc-500 block">
                          @{partner?.username}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemovePartner(partner?.id || rel.id)}
                        className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                        title="End partnership"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
