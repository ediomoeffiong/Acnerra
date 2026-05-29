import { Schema, model } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, trim: true },
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  image: { type: String, default: null },
  bio: { type: String, default: '' },
  accountabilityPartners: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// Convert _id to id virtual getter for frontend compatibility
UserSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

UserSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret: any) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

export const User = model('User', UserSchema);
