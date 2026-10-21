import { Schema, model } from 'mongoose';

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  MISSED = 'MISSED',
  COMPLETED = 'COMPLETED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TaskVisibility {
  PRIVATE = 'PRIVATE',
  SELECTED_PARTNERS = 'SELECTED_PARTNERS',
  WORKSPACE = 'WORKSPACE',
}

export enum ProgressMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export enum RecurrenceFrequency {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

export enum VerificationStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  NEEDS_CLARIFICATION = 'NEEDS_CLARIFICATION',
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

const SubtaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  order: { type: Number, default: 0 },
}, { timestamps: true });

SubtaskSchema.virtual('id').get(function() {
  return this._id.toHexString();
});
SubtaskSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const MilestoneSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  targetDate: { type: Date, default: null },
  status: {
    type: String,
    enum: Object.values(MilestoneStatus),
    default: MilestoneStatus.PENDING,
  },
  completedAt: { type: Date, default: null },
  linkedSubtaskIds: [{ type: Schema.Types.ObjectId }],
  order: { type: Number, default: 0 },
}, { timestamps: true });

MilestoneSchema.virtual('id').get(function() {
  return this._id.toHexString();
});
MilestoneSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const RescheduleRecordSchema = new Schema({
  previousDueDate: { type: Date, default: null },
  newDueDate: { type: Date, required: true },
  reason: { type: String, trim: true, default: '' },
  rescheduledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rescheduledAt: { type: Date, default: Date.now },
}, { _id: false });

const RecurrenceRuleSchema = new Schema({
  frequency: {
    type: String,
    enum: Object.values(RecurrenceFrequency),
    default: RecurrenceFrequency.NONE,
  },
  interval: { type: Number, default: 1, min: 1 },
  daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0 = Sun, 1 = Mon ...
  endDate: { type: Date, default: null },
  count: { type: Number, default: null, min: 1 },
  timezone: { type: String, default: 'UTC' },
}, { _id: false });

const TaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.PENDING },
  priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM },
  dueDate: { type: Date, default: null },

  // Stage 1 Ownership and Access Control
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  partnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  collaboratorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  sharedWithIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  visibility: { type: String, enum: Object.values(TaskVisibility), default: TaskVisibility.PRIVATE },
  isPrivate: { type: Boolean, default: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
  sharingMigratedAt: { type: Date, default: null },

  // Stage 2 Subtasks & Milestones
  subtasks: [SubtaskSchema],
  milestones: [MilestoneSchema],
  progressMode: {
    type: String,
    enum: Object.values(ProgressMode),
    default: ProgressMode.AUTO,
  },
  manualProgress: { type: Number, min: 0, max: 100, default: 0 },

  // Stage 2 Recurring Tasks
  recurrence: { type: RecurrenceRuleSchema, default: () => ({ frequency: RecurrenceFrequency.NONE, interval: 1, daysOfWeek: [], timezone: 'UTC' }) },
  recurringSeriesId: { type: Schema.Types.ObjectId, default: null },
  occurrenceIndex: { type: Number, default: 1 },
  isRecurringInstance: { type: Boolean, default: false },
  originalDueDate: { type: Date, default: null },

  // Stage 2 Rescheduling & Overdue History
  rescheduleHistory: [RescheduleRecordSchema],

  // Stage 2 Completion Verification
  verificationRequired: { type: Boolean, default: false },
  verifierId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  verificationStatus: {
    type: String,
    enum: Object.values(VerificationStatus),
    default: VerificationStatus.NOT_REQUESTED,
  },
  verificationNotes: { type: String, trim: true, default: '' },
  verifiedAt: { type: Date, default: null },
  clarificationRequestedAt: { type: Date, default: null },
}, { timestamps: true });

TaskSchema.pre('validate', function() {
  if (!this.ownerId && this.creatorId) this.ownerId = this.creatorId;
});

// Calculate overall task progress
export const calculateTaskProgress = (task: any): number => {
  if (task.status === TaskStatus.COMPLETED) return 100;

  if (task.progressMode === ProgressMode.MANUAL) {
    return Math.min(100, Math.max(0, task.manualProgress || 0));
  }

  // AUTO Mode: calculate based on subtasks or milestones
  const subtasks = task.subtasks || [];
  const milestones = task.milestones || [];

  if (subtasks.length > 0 && milestones.length > 0) {
    const subtaskCompleted = subtasks.filter((s: any) => s.completed).length;
    const subtaskPct = Math.round((subtaskCompleted / subtasks.length) * 100);

    const milestoneCompleted = milestones.filter((m: any) => m.status === MilestoneStatus.COMPLETED).length;
    const milestonePct = Math.round((milestoneCompleted / milestones.length) * 100);

    return Math.round((subtaskPct * 0.6) + (milestonePct * 0.4));
  }

  if (subtasks.length > 0) {
    const subtaskCompleted = subtasks.filter((s: any) => s.completed).length;
    return Math.round((subtaskCompleted / subtasks.length) * 100);
  }

  if (milestones.length > 0) {
    const milestoneCompleted = milestones.filter((m: any) => m.status === MilestoneStatus.COMPLETED).length;
    return Math.round((milestoneCompleted / milestones.length) * 100);
  }

  return 0;
};

// Convert _id to id for frontend compatibility
TaskSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

TaskSchema.virtual('progress').get(function() {
  return calculateTaskProgress(this);
});

TaskSchema.virtual('isOverdue').get(function() {
  return Boolean(
    this.status !== TaskStatus.COMPLETED &&
    this.dueDate &&
    new Date(this.dueDate).getTime() < Date.now()
  );
});

TaskSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    ret.progress = calculateTaskProgress(doc);
    ret.isOverdue = Boolean(
      ret.status !== TaskStatus.COMPLETED &&
      ret.dueDate &&
      new Date(ret.dueDate).getTime() < Date.now()
    );
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes for high performance
TaskSchema.index({ creatorId: 1 });
TaskSchema.index({ ownerId: 1 });
TaskSchema.index({ partnerId: 1 });
TaskSchema.index({ collaboratorIds: 1 });
TaskSchema.index({ sharedWithIds: 1 });
TaskSchema.index({ workspaceId: 1 });
TaskSchema.index({ recurringSeriesId: 1 });
TaskSchema.index({ verifierId: 1 });
TaskSchema.index({ dueDate: 1, status: 1 });

export const Task = model('Task', TaskSchema);
