import { Schema, model } from 'mongoose';

export enum XPReason {
  TASK_COMPLETED = 'TASK_COMPLETED',
  MILESTONE_COMPLETED = 'MILESTONE_COMPLETED',
  CHECK_IN_SUBMITTED = 'CHECK_IN_SUBMITTED',
  RECURRING_TASK_COMPLETED = 'RECURRING_TASK_COMPLETED',
}

const XPTransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  reason: { type: String, enum: Object.values(XPReason), required: true },
  referenceId: { type: String, required: true },
}, { timestamps: true });

XPTransactionSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

XPTransactionSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Idempotent compound index to prevent duplicate awards for same task/checkin/milestone
XPTransactionSchema.index({ userId: 1, reason: 1, referenceId: 1 }, { unique: true });

export const XPTransaction = model('XPTransaction', XPTransactionSchema);
