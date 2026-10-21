import { Schema, model } from 'mongoose';

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  MISSED = 'MISSED',
  COMPLETED = 'COMPLETED'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum TaskVisibility {
  PRIVATE = 'PRIVATE',
  SELECTED_PARTNERS = 'SELECTED_PARTNERS',
  WORKSPACE = 'WORKSPACE'
}

const TaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.PENDING },
  priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM },
  dueDate: { type: Date, default: null },
  // ownerId is authoritative. creatorId is retained as an immutable historical field
  // and as a compatibility fallback until the Stage 1 migration has run.
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  partnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  collaboratorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  sharedWithIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  visibility: { type: String, enum: Object.values(TaskVisibility), default: TaskVisibility.PRIVATE },
  isPrivate: { type: Boolean, default: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
  sharingMigratedAt: { type: Date, default: null },
}, { timestamps: true });

TaskSchema.pre('validate', function() {
  if (!this.ownerId && this.creatorId) this.ownerId = this.creatorId;
});

// Convert _id to id for frontend compatibility
TaskSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

TaskSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
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

export const Task = model('Task', TaskSchema);
