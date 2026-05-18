import { Schema, model } from 'mongoose';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED'
}

const InviteSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  email: { type: String, required: true, lowercase: true, trim: true },
  status: { type: String, enum: Object.values(InviteStatus), default: InviteStatus.PENDING },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
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
InviteSchema.index({ email: 1 });
InviteSchema.index({ taskId: 1 });

export const Invite = model('Invite', InviteSchema);
