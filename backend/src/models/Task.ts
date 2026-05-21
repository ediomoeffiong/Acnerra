import { Schema, model } from 'mongoose';

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

const TaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.PENDING },
  priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM },
  dueDate: { type: Date, default: null },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  partnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

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
TaskSchema.index({ partnerId: 1 });

export const Task = model('Task', TaskSchema);
