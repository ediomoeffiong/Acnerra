import { Schema, model } from 'mongoose';

export enum CheckInStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  MISSED = 'MISSED',
}

export enum CheckInKind {
  OWNER_PROGRESS = 'OWNER_PROGRESS',
  PARTNER_FEEDBACK = 'PARTNER_FEEDBACK',
}

export enum EvidenceType {
  LINK = 'LINK',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
}

const EvidenceSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: Object.values(EvidenceType), required: true },
  url: { type: String, required: true },
  name: { type: String, required: true },
  size: { type: Number, default: null },
  mimeType: { type: String, default: null },
  storageKey: { type: String, default: null },
}, { _id: false });

const CheckInSchema = new Schema({
  notes: { type: String, trim: true, default: '' },
  status: { type: String, enum: Object.values(CheckInStatus), required: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: Object.values(CheckInKind), default: null },

  // Stage 2 Advanced Progress Tracking
  progress: { type: Number, min: 0, max: 100, default: null },
  completedWork: { type: String, trim: true, default: '' },
  blockers: { type: String, trim: true, default: '' },
  nextSteps: { type: String, trim: true, default: '' },
  isPrivate: { type: Boolean, default: false }, // Private partner feedback only seen by author & task owner
  evidence: [EvidenceSchema],
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
