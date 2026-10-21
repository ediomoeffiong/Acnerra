import { PartnerMode, PartnerRelation, PartnerStatus } from '../models/PartnerRelation';
import { TaskVisibility } from '../models/Task';
import { Workspace } from '../models/Workspace';

export interface TaskPermissions {
  isOwner: boolean;
  canView: boolean;
  canComment: boolean;
  canManage: boolean;
  role: 'OWNER' | 'MONITOR' | 'NONE';
}

export const getIdString = (value: any): string | null => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  if (value.id && typeof value.id !== 'function') return value.id.toString();
  return value.toString();
};

export const getTaskOwnerId = (task: any): string | null =>
  getIdString(task?.ownerId) || getIdString(task?.creatorId);

export const getExplicitMonitorIds = (task: any): string[] => {
  if (task?.visibility === TaskVisibility.PRIVATE || task?.isPrivate === true) return [];
  const ids = [
    ...((task?.sharedWithIds || []).map(getIdString)),
    getIdString(task?.partnerId),
    ...((task?.collaboratorIds || []).map(getIdString)),
  ].filter(Boolean) as string[];
  return Array.from(new Set(ids)).filter((id) => id !== getTaskOwnerId(task));
};

// Compatibility helper for notifications. Authorization must use
// getTaskPermissions because it also checks current relationship state.
export const getTaskParticipantIds = (task: any): string[] =>
  Array.from(new Set([getTaskOwnerId(task), ...getExplicitMonitorIds(task)].filter(Boolean) as string[]));

export const isTaskCreator = (task: any, userId: string): boolean =>
  getTaskOwnerId(task) === userId;

export const canRelationshipMonitor = async (ownerId: string, monitorId: string): Promise<boolean> => {
  const relation = await PartnerRelation.exists({
    status: PartnerStatus.ACCEPTED,
    $or: [
      { mode: PartnerMode.MUTUAL, senderId: ownerId, receiverId: monitorId },
      { mode: PartnerMode.MUTUAL, senderId: monitorId, receiverId: ownerId },
      { mode: PartnerMode.SINGLE, senderId: ownerId, receiverId: monitorId },
    ],
  });
  return Boolean(relation);
};

export const getEligibleMonitorIds = async (ownerId: string): Promise<string[]> => {
  const relations = await PartnerRelation.find({
    status: PartnerStatus.ACCEPTED,
    $or: [
      { mode: PartnerMode.MUTUAL, senderId: ownerId },
      { mode: PartnerMode.MUTUAL, receiverId: ownerId },
      { mode: PartnerMode.SINGLE, senderId: ownerId },
    ],
  }).select('senderId receiverId');

  return Array.from(new Set(relations.map((relation) => {
    const senderId = getIdString(relation.senderId)!;
    const receiverId = getIdString(relation.receiverId)!;
    return senderId === ownerId ? receiverId : senderId;
  })));
};

export const getTaskPermissions = async (task: any, userId: string): Promise<TaskPermissions> => {
  const ownerId = getTaskOwnerId(task);
  if (ownerId === userId) {
    return { isOwner: true, canView: true, canComment: true, canManage: true, role: 'OWNER' };
  }

  if (!ownerId || task?.isPrivate === true || task?.visibility === TaskVisibility.PRIVATE) {
    return { isOwner: false, canView: false, canComment: false, canManage: false, role: 'NONE' };
  }

  let hasExplicitAccess = getExplicitMonitorIds(task).includes(userId);
  if (task?.visibility === TaskVisibility.WORKSPACE && task?.workspaceId) {
    const workspaceAccess = await Workspace.exists({
      _id: getIdString(task.workspaceId),
      collaboratorIds: userId,
    });
    hasExplicitAccess = hasExplicitAccess || Boolean(workspaceAccess);
  }

  const active = hasExplicitAccess && await canRelationshipMonitor(ownerId, userId);
  if (!active) {
    return { isOwner: false, canView: false, canComment: false, canManage: false, role: 'NONE' };
  }

  return { isOwner: false, canView: true, canComment: true, canManage: false, role: 'MONITOR' };
};

export const canAccessTask = async (task: any, userId: string): Promise<boolean> =>
  (await getTaskPermissions(task, userId)).canView;
