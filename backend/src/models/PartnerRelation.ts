import { Schema, model } from 'mongoose';

export enum PartnerMode {
  MUTUAL = 'MUTUAL',
  SINGLE = 'SINGLE'
}

export enum PartnerStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED'
}

const PartnerRelationSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mode: { type: String, enum: Object.values(PartnerMode), required: true },
  status: { type: String, enum: Object.values(PartnerStatus), default: PartnerStatus.PENDING },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });

// Convert _id to id for frontend compatibility
PartnerRelationSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

PartnerRelationSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Indexes
PartnerRelationSchema.index({ senderId: 1 });
PartnerRelationSchema.index({ receiverId: 1 });
PartnerRelationSchema.index({ status: 1 });

export const PartnerRelation = model('PartnerRelation', PartnerRelationSchema);
