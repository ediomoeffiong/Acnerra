import { Schema, model } from 'mongoose';

const NotificationSchema = new Schema({
  type: { type: String, required: true }, // e.g. "INVITE_RECEIVED", "TASK_COMPLETED"
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
  inviteId: { type: Schema.Types.ObjectId, ref: 'Invite', default: null },
  partnerRelationId: { type: Schema.Types.ObjectId, ref: 'PartnerRelation', default: null },
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

export const Notification = model('Notification', NotificationSchema);
