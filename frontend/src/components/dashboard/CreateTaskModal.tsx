import * as React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { 
  Plus, Trash2, Repeat, ShieldCheck, Flag, Users, Lock, 
  ChevronDown, ChevronUp
} from "lucide-react";
import { 
  taskService, 
  type TaskPriority, 
  type TaskVisibility, 
  type ProgressMode, 
  type RecurrenceFrequency,
  type CreateTaskInput
} from "../../services/taskService";
import { partnersService, type PartnerRelation } from "../../services/partnersService";
import { workspaceService, type Workspace } from "../../services/workspaceService";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  // Form State
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = React.useState("");
  const [workspaceId, setWorkspaceId] = React.useState<string>("");
  const [visibility, setVisibility] = React.useState<TaskVisibility>("PRIVATE");
  const [selectedPartnerIds, setSelectedPartnerIds] = React.useState<string[]>([]);
  const [progressMode] = React.useState<ProgressMode>("AUTO");

  // Advanced Accordions
  const [showSubtasks, setShowSubtasks] = React.useState(false);
  const [subtasks, setSubtasks] = React.useState<Array<{ title: string; description?: string }>>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");

  const [showRecurrence, setShowRecurrence] = React.useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = React.useState<RecurrenceFrequency>("NONE");
  const [recurrenceInterval, setRecurrenceInterval] = React.useState(1);
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = React.useState<number[]>([]);

  const [showVerification, setShowVerification] = React.useState(false);
  const [verificationRequired, setVerificationRequired] = React.useState(false);
  const [verifierId, setVerifierId] = React.useState<string>("");

  // Options loaded from API
  const [partners, setPartners] = React.useState<PartnerRelation[]>([]);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDueDate("");
      setWorkspaceId("");
      setVisibility("PRIVATE");
      setSelectedPartnerIds([]);
      setSubtasks([]);
      setNewSubtaskTitle("");
      setRecurrenceFreq("NONE");
      setRecurrenceInterval(1);
      setSelectedDaysOfWeek([]);
      setVerificationRequired(false);
      setVerifierId("");
      setError(null);

      partnersService.getPartners().then((res) => {
        const accepted = res.filter((p) => p.status === "ACCEPTED");
        setPartners(accepted);
      }).catch(console.error);

      workspaceService.getWorkspaces().then(setWorkspaces).catch(console.error);
    }
  }, [isOpen]);

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { title: newSubtaskTitle.trim() }]);
    setNewSubtaskTitle("");
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, idx) => idx !== index));
  };

  const toggleDayOfWeek = (day: number) => {
    if (selectedDaysOfWeek.includes(day)) {
      setSelectedDaysOfWeek(selectedDaysOfWeek.filter((d) => d !== day));
    } else {
      setSelectedDaysOfWeek([...selectedDaysOfWeek, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for your commitment.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        workspaceId: workspaceId || null,
        visibility,
        sharedWithIds: visibility === "PRIVATE" ? [] : selectedPartnerIds,
        progressMode,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        recurrence: recurrenceFreq !== "NONE" ? {
          frequency: recurrenceFreq,
          interval: Number(recurrenceInterval),
          daysOfWeek: selectedDaysOfWeek,
        } : undefined,
        verificationRequired,
        verifierId: verificationRequired && verifierId ? verifierId : undefined,
      };

      await taskService.createTask(payload);
      onTaskCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const daysLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Commitment" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Commitment Title <span className="text-red-400">*</span>
          </label>
          <Input
            placeholder="e.g. Daily Strength Workout, Ship Beta Architecture..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Description / Context
          </label>
          <textarea
            placeholder="What does success look like? What specific rules or constraints apply?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Priority & Deadline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Target Deadline</label>
            <Input
              type="date"
              value={dueDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Workspace Selection if any */}
        {workspaces.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Workspace</label>
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Personal / General (No Workspace)</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Visibility & Partner Sharing */}
        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Accountability Sharing</span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Choose who can monitor this commitment.
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  visibility === "PRIVATE"
                    ? "bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Private</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("SELECTED_PARTNERS")}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  visibility === "SELECTED_PARTNERS"
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Selected Partners</span>
              </button>
            </div>
          </div>

          {/* Partner Picker if Selected Partners */}
          {visibility === "SELECTED_PARTNERS" && (
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <label className="text-[11px] text-zinc-400 block font-medium">
                Select Accountability Buddies:
              </label>
              {partners.length === 0 ? (
                <div className="text-xs text-zinc-500 italic p-2 rounded bg-zinc-950">
                  You have not connected with any partners yet. Invite partners in the Buddies tab.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {partners.map((partner) => {
                    const isSelected = selectedPartnerIds.includes(partner.id);
                    const partnerName = partner.receiverId?.name || partner.receiverId?.username || partner.name || partner.username || "Partner";
                    return (
                      <div
                        key={partner.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPartnerIds(selectedPartnerIds.filter((id) => id !== partner.id));
                          } else {
                            setSelectedPartnerIds([...selectedPartnerIds, partner.id]);
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                          isSelected
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-indigo-600 bg-zinc-800 border-zinc-700"
                        />
                        <span className="font-medium truncate">{partnerName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ACCORDION 1: SUBTASKS (Phase 3) */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="w-full p-3 bg-zinc-900/80 hover:bg-zinc-900 flex items-center justify-between text-xs font-semibold text-zinc-300"
          >
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-indigo-400" />
              <span>Subtasks & Checkpoints</span>
              {subtasks.length > 0 && (
                <Badge variant="primary" className="text-[10px] py-0">
                  {subtasks.length}
                </Badge>
              )}
            </div>
            {showSubtasks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
          </button>

          {showSubtasks && (
            <div className="p-3.5 bg-zinc-950/60 border-t border-zinc-800 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add a subtask step..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  className="h-8 text-xs bg-zinc-900"
                />
                <Button type="button" size="sm" onClick={handleAddSubtask} className="h-8 text-xs shrink-0">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {subtasks.map((st, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{st.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(idx)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ACCORDION 2: RECURRING TASKS (Phase 4) */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRecurrence(!showRecurrence)}
            className="w-full p-3 bg-zinc-900/80 hover:bg-zinc-900 flex items-center justify-between text-xs font-semibold text-zinc-300"
          >
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-purple-400" />
              <span>Recurring Schedule</span>
              {recurrenceFreq !== "NONE" && (
                <Badge variant="primary" className="text-[10px] py-0">
                  {recurrenceFreq}
                </Badge>
              )}
            </div>
            {showRecurrence ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
          </button>

          {showRecurrence && (
            <div className="p-3.5 bg-zinc-950/60 border-t border-zinc-800 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Frequency</label>
                  <select
                    value={recurrenceFreq}
                    onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFrequency)}
                    className="w-full h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                  >
                    <option value="NONE">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="CUSTOM">Custom Interval (Days)</option>
                  </select>
                </div>

                {recurrenceFreq !== "NONE" && (
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Repeat Every</label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                      className="h-8 text-xs bg-zinc-900"
                    />
                  </div>
                )}
              </div>

              {/* Weekly Day of Week Chips */}
              {recurrenceFreq === "WEEKLY" && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] text-zinc-400 block">Repeat on specific days:</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {daysLabels.map((dayName, idx) => {
                      const isSelected = selectedDaysOfWeek.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDayOfWeek(idx)}
                          className={`w-9 h-7 rounded-md text-xs font-medium transition-colors ${
                            isSelected
                              ? "bg-purple-600 text-white font-semibold"
                              : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                          }`}
                        >
                          {dayName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ACCORDION 3: COMPLETION VERIFICATION (Phase 6) */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowVerification(!showVerification)}
            className="w-full p-3 bg-zinc-900/80 hover:bg-zinc-900 flex items-center justify-between text-xs font-semibold text-zinc-300"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Completion Verification</span>
              {verificationRequired && (
                <Badge variant="success" className="text-[10px] py-0">
                  Required
                </Badge>
              )}
            </div>
            {showVerification ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
          </button>

          {showVerification && (
            <div className="p-3.5 bg-zinc-950/60 border-t border-zinc-800 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="verif_checkbox"
                  checked={verificationRequired}
                  onChange={(e) => setVerificationRequired(e.target.checked)}
                  className="rounded text-indigo-600 bg-zinc-800 border-zinc-700"
                />
                <label htmlFor="verif_checkbox" className="text-xs text-zinc-200 font-medium">
                  Require an accountability partner to verify this commitment when completed
                </label>
              </div>

              {verificationRequired && (
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    Designated Verifier:
                  </label>
                  <select
                    value={verifierId}
                    onChange={(e) => setVerifierId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                  >
                    <option value="">Any monitoring partner</option>
                    {partners.map((p) => {
                      const name = p.receiverId?.name || p.receiverId?.username || p.name || p.username || "Partner";
                      return (
                        <option key={p.id} value={p.id}>{name}</option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={submitting}>
            Create Commitment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
