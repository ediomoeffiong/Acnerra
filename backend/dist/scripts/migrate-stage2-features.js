"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const Task_1 = require("../models/Task");
const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
const rollback = process.argv.includes('--rollback');
const main = async () => {
    if (!uri)
        throw new Error('MONGO_URI or DATABASE_URL is required.');
    if (apply && process.env.MIGRATION_BACKUP_CONFIRMED !== 'true') {
        throw new Error('Set MIGRATION_BACKUP_CONFIRMED=true only after taking and verifying a database backup.');
    }
    await mongoose_1.default.connect(uri);
    const tasksCollection = mongoose_1.default.connection.collection('tasks');
    const usersCollection = mongoose_1.default.connection.collection('users');
    const tasksBefore = await tasksCollection.countDocuments();
    const usersBefore = await usersCollection.countDocuments();
    if (rollback) {
        console.log(`${apply ? 'Rolling back' : 'Would roll back'} Stage 2 fields...`);
        if (apply) {
            await tasksCollection.updateMany({}, {
                $unset: {
                    subtasks: '',
                    milestones: '',
                    progressMode: '',
                    manualProgress: '',
                    recurrence: '',
                    recurringSeriesId: '',
                    occurrenceIndex: '',
                    isRecurringInstance: '',
                    originalDueDate: '',
                    rescheduleHistory: '',
                    verificationRequired: '',
                    verifierId: '',
                    verificationStatus: '',
                    verificationNotes: '',
                    verifiedAt: '',
                    clarificationRequestedAt: '',
                    stage2MigratedAt: '',
                },
            });
            await usersCollection.updateMany({}, {
                $unset: {
                    xp: '',
                    level: '',
                    currentStreak: '',
                    longestStreak: '',
                    achievements: '',
                    onboardingCompleted: '',
                    onboardingStep: '',
                    preferences: '',
                    stage2MigratedAt: '',
                },
            });
        }
    }
    else {
        console.log(`Starting Stage 2 migration check (${apply ? 'APPLY' : 'DRY RUN'})...`);
        // 1. Migrate tasks
        const unmigratedTasks = await tasksCollection.countDocuments({ stage2MigratedAt: { $exists: false } });
        console.log(`Found ${unmigratedTasks} tasks requiring Stage 2 schema defaults.`);
        if (apply) {
            await tasksCollection.updateMany({ stage2MigratedAt: { $exists: false } }, {
                $set: {
                    subtasks: [],
                    milestones: [],
                    progressMode: Task_1.ProgressMode.AUTO,
                    manualProgress: 0,
                    recurrence: { frequency: Task_1.RecurrenceFrequency.NONE, interval: 1, daysOfWeek: [], timezone: 'UTC' },
                    rescheduleHistory: [],
                    verificationRequired: false,
                    verificationStatus: Task_1.VerificationStatus.NOT_REQUESTED,
                    stage2MigratedAt: new Date(),
                },
            });
        }
        // 2. Migrate users
        const unmigratedUsers = await usersCollection.countDocuments({ stage2MigratedAt: { $exists: false } });
        console.log(`Found ${unmigratedUsers} users requiring Stage 2 schema defaults.`);
        if (apply) {
            // Existing active users should have onboardingCompleted: true so we don't disrupt them
            await usersCollection.updateMany({ stage2MigratedAt: { $exists: false } }, {
                $set: {
                    xp: 0,
                    level: 1,
                    currentStreak: 0,
                    longestStreak: 0,
                    achievements: [],
                    onboardingCompleted: true, // Existing users keep running without mandatory onboarding
                    onboardingStep: 6,
                    preferences: {
                        emailNotifications: true,
                        categories: { tasks: true, invites: true, feedback: true, verification: true, reminders: true },
                        reminderTiming: '1_DAY',
                        quietHours: { enabled: false, start: '22:00', end: '08:00' },
                        digestFrequency: 'NONE',
                    },
                    stage2MigratedAt: new Date(),
                },
            });
        }
    }
    const tasksAfter = await tasksCollection.countDocuments();
    const usersAfter = await usersCollection.countDocuments();
    if (tasksBefore !== tasksAfter || usersBefore !== usersAfter) {
        throw new Error(`Record count mismatch detected! Tasks: ${tasksBefore}->${tasksAfter}, Users: ${usersBefore}->${usersAfter}`);
    }
    console.log(`Verified record counts preserved. Mode: ${apply ? 'APPLY' : 'DRY RUN'}. Migration completed.`);
    await mongoose_1.default.disconnect();
};
main().catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await mongoose_1.default.disconnect();
    process.exitCode = 1;
});
