import { Schema, model } from 'mongoose';

const WorkspaceSchema = new Schema({
  name: { type: String, required: true, trim: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

// Convert _id to id for frontend compatibility
WorkspaceSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

WorkspaceSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Index for query speed
WorkspaceSchema.index({ userId: 1 });

export const Workspace = model('Workspace', WorkspaceSchema);
