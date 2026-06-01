import { CheckIn, CheckInStatus } from '../models/CheckIn';
import { Task, TaskStatus } from '../models/Task';

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const calculateUserStreak = async (userId: string) => {
  const [checkIns, completedTasks] = await Promise.all([
    CheckIn.find({ userId }).select('status createdAt').sort({ createdAt: 1 }),
    Task.find({ creatorId: userId, status: TaskStatus.COMPLETED }).select('updatedAt').sort({ updatedAt: 1 }),
  ]);

  const successfulDays = new Set<string>();
  const missedDays = new Set<string>();

  checkIns.forEach((checkIn: any) => {
    const key = toDateKey(new Date(checkIn.createdAt));
    if (checkIn.status === CheckInStatus.MISSED) {
      missedDays.add(key);
      successfulDays.delete(key);
      return;
    }
    successfulDays.add(key);
  });

  completedTasks.forEach((task: any) => {
    const key = toDateKey(new Date(task.updatedAt));
    if (!missedDays.has(key)) {
      successfulDays.add(key);
    }
  });

  const today = new Date();
  const todayKey = toDateKey(today);
  const yesterday = addDays(today, -1);
  const yesterdayKey = toDateKey(yesterday);

  let cursor: Date | null = null;
  if (successfulDays.has(todayKey) && !missedDays.has(todayKey)) {
    cursor = today;
  } else if (successfulDays.has(yesterdayKey) && !missedDays.has(yesterdayKey)) {
    cursor = yesterday;
  }

  let streakDays = 0;
  if (cursor) {
    while (true) {
      const key = toDateKey(cursor);
      if (!successfulDays.has(key) || missedDays.has(key)) break;
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
