import { Task, TaskStatus, RecurrenceFrequency } from '../models/Task';

export const getNextOccurrenceDate = (
  currentDate: Date,
  rule: {
    frequency: RecurrenceFrequency;
    interval?: number;
    daysOfWeek?: number[];
    endDate?: Date | null;
  }
): Date | null => {
  const interval = Math.max(1, rule.interval || 1);
  const next = new Date(currentDate.getTime());

  if (rule.frequency === RecurrenceFrequency.DAILY) {
    next.setUTCDate(next.getUTCDate() + interval);
  } else if (rule.frequency === RecurrenceFrequency.WEEKLY) {
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      // Find the next day of week from the list
      const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
      const currentDay = next.getUTCDay();
      const futureDays = sortedDays.filter((d) => d > currentDay);

      if (futureDays.length > 0) {
        // Next day in the same week
        const diff = futureDays[0] - currentDay;
        next.setUTCDate(next.getUTCDate() + diff);
      } else {
        // Wrap to the first day in the next interval week
        const daysToNextWeek = (7 - currentDay) + sortedDays[0] + (interval - 1) * 7;
        next.setUTCDate(next.getUTCDate() + daysToNextWeek);
      }
    } else {
      next.setUTCDate(next.getUTCDate() + interval * 7);
    }
  } else if (rule.frequency === RecurrenceFrequency.MONTHLY) {
    const originalDay = next.getUTCDate();
    const currentMonth = next.getUTCMonth();
    const targetMonth = currentMonth + interval;

    // Set to first day of target month, then calculate max days in that month
    next.setUTCDate(1);
    next.setUTCMonth(targetMonth);
    const maxDaysInTargetMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    // Clamp to valid date (e.g. Jan 31 -> Feb 28/29)
    next.setUTCDate(Math.min(originalDay, maxDaysInTargetMonth));
  } else if (rule.frequency === RecurrenceFrequency.CUSTOM) {
    next.setUTCDate(next.getUTCDate() + interval);
  } else {
    return null;
  }

  // Check end date bound
  if (rule.endDate && next.getTime() > new Date(rule.endDate).getTime()) {
    return null;
  }

  return next;
};

export const generateNextOccurrence = async (task: any): Promise<any | null> => {
  if (!task.recurrence || task.recurrence.frequency === RecurrenceFrequency.NONE) {
    return null;
  }

  const seriesId = task.recurringSeriesId || task._id;
  const occurrenceIndex = (task.occurrenceIndex || 1) + 1;

  if (task.recurrence.count && occurrenceIndex > task.recurrence.count) {
    return null;
  }

  const baseDate = task.dueDate ? new Date(task.dueDate) : new Date(task.createdAt || Date.now());
  const nextDate = getNextOccurrenceDate(baseDate, task.recurrence);
  if (!nextDate) return null;

  // Prevent duplicate occurrence generation for same series and dueDate
  const existing = await Task.findOne({
    recurringSeriesId: seriesId,
    dueDate: nextDate,
  });

  if (existing) {
    return existing;
  }

  // Create clone for new occurrence with clean state
  const newSubtasks = (task.subtasks || []).map((s: any) => ({
    title: s.title,
    description: s.description || '',
    completed: false,
    completedAt: null,
    dueDate: s.dueDate ? getNextOccurrenceDate(new Date(s.dueDate), task.recurrence) : null,
    order: s.order || 0,
  }));

  const nextOccurrence = await Task.create({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: TaskStatus.PENDING,
    dueDate: nextDate,
    ownerId: task.ownerId,
    creatorId: task.creatorId,
    visibility: task.visibility,
    isPrivate: task.isPrivate,
    sharedWithIds: task.sharedWithIds || [],
    collaboratorIds: task.collaboratorIds || [],
    partnerId: task.partnerId || null,
    workspaceId: task.workspaceId || null,
    recurrence: task.recurrence,
    recurringSeriesId: seriesId,
    occurrenceIndex,
    isRecurringInstance: true,
    originalDueDate: nextDate,
    verificationRequired: task.verificationRequired || false,
    verifierId: task.verifierId || null,
    subtasks: newSubtasks,
    progressMode: task.progressMode,
    manualProgress: 0,
  });

  // Ensure original task has its seriesId set
  if (!task.recurringSeriesId) {
    task.recurringSeriesId = seriesId;
    await task.save();
  }

  return nextOccurrence;
};
