"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateUserStreak = void 0;
const CheckIn_1 = require("../models/CheckIn");
const Task_1 = require("../models/Task");
const toDateKey = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};
const calculateUserStreak = async (userId) => {
    const [checkIns, completedTasks] = await Promise.all([
        CheckIn_1.CheckIn.find({ userId }).select('status createdAt').sort({ createdAt: 1 }),
        Task_1.Task.find({ creatorId: userId, status: Task_1.TaskStatus.COMPLETED }).select('updatedAt').sort({ updatedAt: 1 }),
    ]);
    const successfulDays = new Set();
    const missedDays = new Set();
    checkIns.forEach((checkIn) => {
        const key = toDateKey(new Date(checkIn.createdAt));
        if (checkIn.status === CheckIn_1.CheckInStatus.MISSED) {
            missedDays.add(key);
            successfulDays.delete(key);
            return;
        }
        successfulDays.add(key);
    });
    completedTasks.forEach((task) => {
        const key = toDateKey(new Date(task.updatedAt));
        if (!missedDays.has(key)) {
            successfulDays.add(key);
        }
    });
    const today = new Date();
    const todayKey = toDateKey(today);
    const yesterday = addDays(today, -1);
    const yesterdayKey = toDateKey(yesterday);
    let cursor = null;
    if (successfulDays.has(todayKey) && !missedDays.has(todayKey)) {
        cursor = today;
    }
    else if (successfulDays.has(yesterdayKey) && !missedDays.has(yesterdayKey)) {
        cursor = yesterday;
    }
    let streakDays = 0;
    if (cursor) {
        while (true) {
            const key = toDateKey(cursor);
            if (!successfulDays.has(key) || missedDays.has(key))
                break;
            streakDays += 1;
            cursor = addDays(cursor, -1);
        }
    }
    return {
        streakDays,
        streakDates: Array.from(successfulDays).sort(),
        missedDates: Array.from(missedDays).sort(),
    };
};
exports.calculateUserStreak = calculateUserStreak;
