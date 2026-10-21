import * as React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Clock } from "lucide-react";
import { taskService, type Task } from "../../services/taskService";

interface RescheduleModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onRescheduled: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  task,
  isOpen,
  onClose,
  onRescheduled,
}) => {
  const [newDueDate, setNewDueDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setNewDueDate("");
      setReason("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDueDate) {
      setError("Please select a new target deadline in the future.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await taskService.rescheduleTask(task.id, {
        newDueDate: new Date(newDueDate).toISOString(),
        reason: reason.trim() || undefined,
      });
      onRescheduled();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to reschedule task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Commitment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
          <div className="text-xs text-zinc-400">Current Commitment</div>
          <div className="text-sm font-semibold text-zinc-200">{task.title}</div>
          {task.dueDate && (
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                Previous deadline: {new Date(task.dueDate).toLocaleDateString()}
              </span>
              {task.isOverdue && (
                <span className="text-red-400 font-semibold">(Overdue)</span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            New Target Deadline <span className="text-red-400">*</span>
          </label>
          <Input
            type="date"
            value={newDueDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setNewDueDate(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Reason for Rescheduling (Optional)
          </label>
          <textarea
            placeholder="e.g. Scope expanded, unexpected blocker, prioritised another commitment..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-[10px] text-zinc-400 block mt-1">
            Rescheduling preserves deadline history so you can track consistency over time.
          </span>
        </div>

        {/* Existing reschedule history if any */}
        {task.rescheduleHistory && task.rescheduleHistory.length > 0 && (
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
            <span className="text-[11px] font-semibold text-zinc-400 block">
              Previous Reschedules ({task.rescheduleHistory.length})
            </span>
            <div className="space-y-1 max-h-24 overflow-y-auto text-[11px] text-zinc-400">
              {task.rescheduleHistory.map((rh, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>New: {new Date(rh.newDueDate).toLocaleDateString()}</span>
                  <span className="text-zinc-500 truncate max-w-[150px]">{rh.reason || "No reason"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={submitting}>
            Save New Deadline
          </Button>
        </div>
      </form>
    </Modal>
  );
};
