import { Schema, model } from 'mongoose';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED'
}

const InviteSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(InviteStatus), default: InviteStatus.PENDING },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });

InviteSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

InviteSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes
InviteSchema.index({ senderId: 1 });
InviteSchema.index({ receiverId: 1 });
InviteSchema.index({ taskId: 1 });
InviteSchema.index(
  { senderId: 1, receiverId: 1, taskId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: InviteStatus.PENDING } }
);

export const Invite = model('Invite', InviteSchema);
