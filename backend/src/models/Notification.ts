import { Schema, model } from 'mongoose';

export enum NotificationCategory {
  TASKS = 'TASKS',
  INVITES = 'INVITES',
  FEEDBACK = 'FEEDBACK',
  VERIFICATION = 'VERIFICATION',
  REMINDERS = 'REMINDERS',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
}

const NotificationSchema = new Schema({
  type: { type: String, required: true }, // e.g. "INVITE_RECEIVED", "TASK_COMPLETED", "PROGRESS_REQUEST", "VERIFICATION_REQUEST"
  category: {
    type: String,
    enum: Object.values(NotificationCategory),
    default: NotificationCategory.TASKS,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  priority: {
    type: String,
    enum: Object.values(NotificationPriority),
    default: NotificationPriority.NORMAL,
  },
  actionUrl: { type: String, default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
  inviteId: { type: Schema.Types.ObjectId, ref: 'Invite', default: null },
  partnerRelationId: { type: Schema.Types.ObjectId, ref: 'PartnerRelation', default: null },
  progressRequestId: { type: Schema.Types.ObjectId, ref: 'ProgressRequest', default: null },
}, { timestamps: true });

NotificationSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

NotificationSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });

export const Notification = model('Notification', NotificationSchema);
