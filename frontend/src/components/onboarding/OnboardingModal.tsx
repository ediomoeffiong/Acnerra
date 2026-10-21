import * as React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { 
  Sparkles, ShieldCheck, Target, Users, CheckCircle2, ArrowRight, 
  ArrowLeft, Award, Flame, Flag, Clock, X
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { taskService } from "../../services/taskService";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { user, completeOnboarding } = useAuth();
  const [step, setStep] = React.useState(1);
  const totalSteps = 6;

  // Step 3 mini task creation state
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskDueDate, setTaskDueDate] = React.useState("");
  const [creatingTask, setCreatingTask] = React.useState(false);
  const [taskCreatedSuccess, setTaskCreatedSuccess] = React.useState(false);
  const [taskError, setTaskError] = React.useState<string | null>(null);

  // Reset or initialize step
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTaskTitle("");
      setTaskDueDate("");
      setTaskCreatedSuccess(false);
      setTaskError(null);
    }
  }, [isOpen]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight" && step < totalSteps) {
        setStep((s) => s + 1);
      } else if (e.key === "ArrowLeft" && step > 1) {
        setStep((s) => s - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step]);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSkip = async () => {
    await completeOnboarding(totalSteps);
    onClose();
  };

  const handleComplete = async () => {
    await completeOnboarding(totalSteps);
    onClose();
  };

  const handleCreateMiniTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setTaskError("Please enter a title for your first commitment.");
      return;
    }

    setCreatingTask(true);
    setTaskError(null);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await taskService.createTask({
        title: taskTitle.trim(),
        dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : tomorrow.toISOString(),
        visibility: 'PRIVATE',
      });
      setTaskCreatedSuccess(true);
      if (onTaskCreated) onTaskCreated();
      setTimeout(() => {
        setStep(4);
      }, 800);
    } catch (err: any) {
      setTaskError(err?.response?.data?.message || "Failed to create task.");
    } finally {
      setCreatingTask(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleSkip} title="" size="lg">
      <div className="relative -mt-4">
        {/* Top Header Controls */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-xs border border-indigo-500/20">
              {step}/{totalSteps}
            </span>
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {step === 1 && "Welcome"}
              {step === 2 && "Ownership & Privacy"}
              {step === 3 && "First Commitment"}
              {step === 4 && "Accountability Buddies"}
              {step === 5 && "Progress & Verification"}
              {step === 6 && "Ready to Start"}
            </span>
          </div>

          <button
            onClick={handleSkip}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-800 flex items-center gap-1"
            title="Skip onboarding tour"
          >
            <span>Skip tour</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden my-4">
          <div 
            className="bg-indigo-500 h-full transition-all duration-300 ease-out rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Contents */}
        <div className="py-2 min-h-[320px] flex flex-col justify-between">
          {/* STEP 1: WELCOME */}
          {step === 1 && (
            <div className="space-y-4 text-center my-auto">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/5">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-100">
                  Welcome to Acnerra{user?.name ? `, ${user.name}` : ""}
                </h3>
                <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
                  Turn your goals into commitments and stay consistent with people who support you.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-left">
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                  <Target className="w-5 h-5 text-indigo-400 mb-1" />
                  <div className="text-xs font-semibold text-zinc-200">Set Commitments</div>
                  <div className="text-[11px] text-zinc-400">Clear deadlines, subtasks, and target milestones.</div>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                  <Users className="w-5 h-5 text-emerald-400 mb-1" />
                  <div className="text-xs font-semibold text-zinc-200">Accountability</div>
                  <div className="text-[11px] text-zinc-400">Share with trusted partners who monitor your follow-through.</div>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                  <Flame className="w-5 h-5 text-amber-400 mb-1" />
                  <div className="text-xs font-semibold text-zinc-200">Consistency & XP</div>
                  <div className="text-[11px] text-zinc-400">Build unbroken consistency streaks and level up.</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: HOW TASKS WORK */}
          {step === 2 && (
            <div className="space-y-4 my-auto">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  How Tasks & Ownership Work
                </h3>
                <p className="text-zinc-400 text-xs">
                  Acnerra is built on strict task ownership and explicit user consent.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-200">You own your tasks</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Tasks always belong to the person who created them. Only the owner can edit details, change deadlines, check off subtasks, or delete the task.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-200">Sharing is completely optional</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      New tasks are private by default. You decide which specific commitments to share with accountability buddies and which to keep private.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-200">Partners monitor and encourage</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Partners can cheer you on, ask for progress updates, and verify completion, but they can never hijack or alter your progress.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CREATE FIRST TASK */}
          {step === 3 && (
            <div className="space-y-4 my-auto">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-400" />
                  Set Your First Commitment
                </h3>
                <p className="text-zinc-400 text-xs">
                  What is one important goal or habit you want to follow through on this week?
                </p>
              </div>

              {taskCreatedSuccess ? (
                <div className="p-6 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <div className="font-semibold text-zinc-100 text-sm">Commitment Created!</div>
                  <div className="text-xs text-zinc-400">"{taskTitle}" has been added to your dashboard.</div>
                </div>
              ) : (
                <form onSubmit={handleCreateMiniTask} className="space-y-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  {taskError && (
                    <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400 text-xs">
                      {taskError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Task Title <span className="text-red-400">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Read 20 pages every day, Complete UI redesign..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Target Due Date (Optional)
                    </label>
                    <Input
                      type="date"
                      value={taskDueDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">
                      You can add subtasks and recurrence later from the task page.
                    </span>
                    <Button type="submit" size="sm" loading={creatingTask}>
                      Save Commitment
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STEP 4: PARTNERS */}
          {step === 4 && (
            <div className="space-y-4 my-auto">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Accountability Partnerships
                </h3>
                <p className="text-zinc-400 text-xs">
                  Stay accountable with partners who genuinely support your growth.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <Badge variant="outline" className="border-indigo-500/40 text-indigo-400">
                    Mutual Partnership
                  </Badge>
                  <h4 className="text-sm font-semibold text-zinc-200">Two-Way Accountability</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    You and your partner monitor each other's shared goals, leave constructive feedback, and cheer each other on.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                    Single Partnership
                  </Badge>
                  <h4 className="text-sm font-semibold text-zinc-200">Mentorship / Monitoring</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    One person acts as a mentor or accountability coach reviewing the other's progress without sharing their own tasks.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>You can search and invite partners at any time from the Accountability Buddies menu.</span>
              </div>
            </div>
          )}

          {/* STEP 5: PROGRESS TRACKING */}
          {step === 5 && (
            <div className="space-y-4 my-auto">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                  <Flag className="w-5 h-5 text-indigo-400" />
                  Tracking, Check-ins & Verification
                </h3>
                <p className="text-zinc-400 text-xs">
                  Meaningful features designed to keep your momentum going every day.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  <div className="text-xs font-semibold text-zinc-200">Check-ins & Evidence</div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Share progress percentages, notes, blockers, next steps, and optional screenshots or document evidence.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <Flag className="w-5 h-5 text-emerald-400" />
                  <div className="text-xs font-semibold text-zinc-200">Subtasks & Milestones</div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Break big goals into manageable subtasks. Progress auto-calculates as you complete each step.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <div className="text-xs font-semibold text-zinc-200">Partner Verification</div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    For high-stakes goals, require partner verification before completion is officially marked verified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: START USING */}
          {step === 6 && (
            <div className="space-y-4 text-center my-auto">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/5">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-100">
                  You're Ready to Build Consistency!
                </h3>
                <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
                  Your personalized dashboard is ready. Focus on today's commitments, log your daily progress, and stay consistent.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Tip: Complete actions daily to earn XP and grow your consistency streak!</span>
              </div>
            </div>
          )}

          {/* Bottom Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={step === 1}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setStep(idx + 1)}
                  className={`h-2 rounded-full transition-all ${
                    step === idx + 1 ? "w-6 bg-indigo-500" : "w-2 bg-zinc-700 hover:bg-zinc-600"
                  }`}
                  aria-label={`Go to step ${idx + 1}`}
                />
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              className="gap-1.5"
            >
              <span>{step === totalSteps ? "Enter Dashboard" : "Continue"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
