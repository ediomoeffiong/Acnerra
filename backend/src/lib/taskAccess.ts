export const getIdString = (value: any): string | null => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

export const getTaskParticipantIds = (task: any): string[] => {
  if (task.isPrivate) {
    return [getIdString(task.creatorId)].filter(Boolean) as string[];
  }
  const ids = [
    getIdString(task.creatorId),
    getIdString(task.partnerId),
    ...((task.collaboratorIds || []).map((id: any) => getIdString(id))),
  ].filter(Boolean) as string[];

  return Array.from(new Set(ids));
};

export const canAccessTask = (task: any, userId: string): boolean => {
  return getTaskParticipantIds(task).includes(userId);
};

export const isTaskCreator = (task: any, userId: string): boolean => {
  return getIdString(task.creatorId) === userId;
};
