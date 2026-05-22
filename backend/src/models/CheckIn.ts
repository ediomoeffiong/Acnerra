import { Schema, model } from 'mongoose';

export enum CheckInStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  MISSED = 'MISSED'
}

const CheckInSchema = new Schema({
  notes: { type: String, trim: true, default: '' },
  status: { type: String, enum: Object.values(CheckInStatus), required: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

CheckInSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

CheckInSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

CheckInSchema.index({ taskId: 1 });
CheckInSchema.index({ userId: 1 });
CheckInSchema.index({ taskId: 1, createdAt: -1 });

export const CheckIn = model('CheckIn', CheckInSchema);
