import { Schema, model } from 'mongoose';

export enum NotificationReminderTiming {
  ONE_HOUR = '1_HOUR',
  SAME_DAY = 'SAME_DAY',
  ONE_DAY = '1_DAY',
}

export enum DigestFrequency {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

const AchievementSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: 'award' },
  unlockedAt: { type: Date, default: Date.now },
}, { _id: false });

const UserPreferencesSchema = new Schema({
  emailNotifications: { type: Boolean, default: true },
  categories: {
    tasks: { type: Boolean, default: true },
    invites: { type: Boolean, default: true },
    feedback: { type: Boolean, default: true },
    verification: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true },
  },
  reminderTiming: {
    type: String,
    enum: Object.values(NotificationReminderTiming),
    default: NotificationReminderTiming.ONE_DAY,
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '22:00' },
    end: { type: String, default: '08:00' },
  },
  digestFrequency: {
    type: String,
    enum: Object.values(DigestFrequency),
    default: DigestFrequency.NONE,
  },
}, { _id: false });

const UserSchema = new Schema({
  name: { type: String, trim: true },
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  image: { type: String, default: null },
  bio: { type: String, default: '' },
  accountabilityPartners: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  // Gamification (Stage 2)
  xp: { type: Number, default: 0, min: 0 },
  level: { type: Number, default: 1, min: 1 },
  currentStreak: { type: Number, default: 0, min: 0 },
  longestStreak: { type: Number, default: 0, min: 0 },
  lastActiveDate: { type: Date, default: null },
  achievements: [AchievementSchema],

  // First-time onboarding (Stage 2)
  onboardingCompleted: { type: Boolean, default: false },
  onboardingStep: { type: Number, default: 0 },

  // Notification preferences (Stage 2)
  preferences: { type: UserPreferencesSchema, default: () => ({}) },
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
