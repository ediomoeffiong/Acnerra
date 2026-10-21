import { Schema, model } from 'mongoose';

export enum ProgressRequestStatus {
  PENDING = 'PENDING',
  RESPONDED = 'RESPONDED',
  MUTED = 'MUTED',
}

const ProgressRequestSchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: Object.values(ProgressRequestStatus),
    default: ProgressRequestStatus.PENDING,
  },
  message: { type: String, trim: true, default: '' },
  requestedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
  responseNotes: { type: String, trim: true, default: '' },
}, { timestamps: true });

ProgressRequestSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

ProgressRequestSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

ProgressRequestSchema.index({ taskId: 1, requesterId: 1, status: 1 });
ProgressRequestSchema.index({ ownerId: 1, status: 1 });
ProgressRequestSchema.index({ taskId: 1, createdAt: -1 });

export const ProgressRequest = model('ProgressRequest', ProgressRequestSchema);
