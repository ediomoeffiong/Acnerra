import * as React from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { 
  Clock, ShieldCheck, MessageSquare, Check, X
} from "lucide-react";
import type { NeedsAttentionItem } from "../../services/taskService";
import { useNavigate } from "react-router-dom";

interface NeedsAttentionSectionProps {
  items: NeedsAttentionItem[];
  onAcceptInvite?: (inviteId: string) => Promise<void>;
  onDeclineInvite?: (inviteId: string) => Promise<void>;
  onOpenRescheduleModal?: (taskId: string) => void;
}

export const NeedsAttentionSection: React.FC<NeedsAttentionSectionProps> = ({
  items,
  onAcceptInvite,
  onDeclineInvite,
  onOpenRescheduleModal,
}) => {
  const navigate = useNavigate();
  const [actingId, setActingId] = React.useState<string | null>(null);

  if (!items || items.length === 0) return null;

  const handleAccept = async (inviteId: string) => {
    if (!onAcceptInvite) return;
    setActingId(`accept_${inviteId}`);
    try {
      await onAcceptInvite(inviteId);
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    if (!onDeclineInvite) return;
    setActingId(`decline_${inviteId}`);
    try {
      await onDeclineInvite(inviteId);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            Needs Your Attention
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
            {items.length} actionable item{items.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const isInvite = item.type === 'INVITE';
          const isProgressReq = item.type === 'PROGRESS_REQUEST';
          const isVerification = item.type === 'VERIFICATION_REQUEST';
          const isOverdue = item.type === 'OVERDUE_TASK';

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                isOverdue
                  ? "bg-red-950/20 border-red-500/30"
                  : isVerification
                  ? "bg-indigo-950/20 border-indigo-500/30"
                  : isProgressReq
                  ? "bg-amber-950/20 border-amber-500/30"
                  : "bg-zinc-900 border-zinc-800"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0.5 ${
                      isOverdue
                        ? "border-red-500/40 text-red-400 bg-red-500/10"
                        : isVerification
                        ? "border-indigo-500/40 text-indigo-400 bg-indigo-500/10"
                        : isProgressReq
                        ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                        : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    }`}
                  >
                    {isInvite && "Partner Invite"}
                    {isProgressReq && "Update Requested"}
                    {isVerification && "Verification Request"}
                    {isOverdue && "Overdue Commitment"}
                  </Badge>

                  <span className="text-[10px] text-zinc-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-zinc-200 line-clamp-1">
                  {item.title}
                </h4>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {item.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-end gap-2">
                {isInvite && item.inviteId && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(item.inviteId!)}
                      loading={actingId === `decline_${item.inviteId}`}
                      className="text-xs h-8 px-2.5"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAccept(item.inviteId!)}
                      loading={actingId === `accept_${item.inviteId}`}
                      className="text-xs h-8 px-2.5"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Accept
                    </Button>
                  </>
                )}

                {isProgressReq && item.taskId && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/tasks/${item.taskId}`)}
                    className="text-xs h-8 px-3 gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Post Progress Update</span>
                  </Button>
                )}

                {isVerification && item.taskId && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/tasks/${item.taskId}`)}
                    className="text-xs h-8 px-3 gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Review & Verify</span>
                  </Button>
                )}

                {isOverdue && item.taskId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (onOpenRescheduleModal) {
                        onOpenRescheduleModal(item.taskId!);
                      } else {
                        navigate(`/tasks/${item.taskId}`);
                      }
                    }}
                    className="text-xs h-8 px-3 gap-1.5 border-red-500/30 text-red-300 hover:text-white"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reschedule</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
