"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAccessTask = exports.getTaskPermissions = exports.getEligibleMonitorIds = exports.canRelationshipMonitor = exports.isTaskCreator = exports.getTaskParticipantIds = exports.getExplicitMonitorIds = exports.getTaskOwnerId = exports.getIdString = void 0;
const PartnerRelation_1 = require("../models/PartnerRelation");
const Task_1 = require("../models/Task");
const Workspace_1 = require("../models/Workspace");
const getIdString = (value) => {
    if (!value)
        return null;
    if (value._id)
        return value._id.toString();
    if (value.id && typeof value.id !== 'function')
        return value.id.toString();
    return value.toString();
};
exports.getIdString = getIdString;
const getTaskOwnerId = (task) => (0, exports.getIdString)(task?.ownerId) || (0, exports.getIdString)(task?.creatorId);
exports.getTaskOwnerId = getTaskOwnerId;
const getExplicitMonitorIds = (task) => {
    if (task?.visibility === Task_1.TaskVisibility.PRIVATE || task?.isPrivate === true)
        return [];
    const ids = [
        ...((task?.sharedWithIds || []).map(exports.getIdString)),
        (0, exports.getIdString)(task?.partnerId),
        ...((task?.collaboratorIds || []).map(exports.getIdString)),
    ].filter(Boolean);
    return Array.from(new Set(ids)).filter((id) => id !== (0, exports.getTaskOwnerId)(task));
};
exports.getExplicitMonitorIds = getExplicitMonitorIds;
// Compatibility helper for notifications. Authorization must use
// getTaskPermissions because it also checks current relationship state.
const getTaskParticipantIds = (task) => Array.from(new Set([(0, exports.getTaskOwnerId)(task), ...(0, exports.getExplicitMonitorIds)(task)].filter(Boolean)));
exports.getTaskParticipantIds = getTaskParticipantIds;
const isTaskCreator = (task, userId) => (0, exports.getTaskOwnerId)(task) === userId;
exports.isTaskCreator = isTaskCreator;
const canRelationshipMonitor = async (ownerId, monitorId) => {
    const relation = await PartnerRelation_1.PartnerRelation.exists({
        status: PartnerRelation_1.PartnerStatus.ACCEPTED,
        $or: [
            { mode: PartnerRelation_1.PartnerMode.MUTUAL, senderId: ownerId, receiverId: monitorId },
            { mode: PartnerRelation_1.PartnerMode.MUTUAL, senderId: monitorId, receiverId: ownerId },
            { mode: PartnerRelation_1.PartnerMode.SINGLE, senderId: ownerId, receiverId: monitorId },
        ],
    });
    return Boolean(relation);
};
exports.canRelationshipMonitor = canRelationshipMonitor;
const getEligibleMonitorIds = async (ownerId) => {
    const relations = await PartnerRelation_1.PartnerRelation.find({
        status: PartnerRelation_1.PartnerStatus.ACCEPTED,
        $or: [
            { mode: PartnerRelation_1.PartnerMode.MUTUAL, senderId: ownerId },
            { mode: PartnerRelation_1.PartnerMode.MUTUAL, receiverId: ownerId },
            { mode: PartnerRelation_1.PartnerMode.SINGLE, senderId: ownerId },
        ],
    }).select('senderId receiverId');
    return Array.from(new Set(relations.map((relation) => {
        const senderId = (0, exports.getIdString)(relation.senderId);
        const receiverId = (0, exports.getIdString)(relation.receiverId);
        return senderId === ownerId ? receiverId : senderId;
    })));
};
exports.getEligibleMonitorIds = getEligibleMonitorIds;
const getTaskPermissions = async (task, userId) => {
    const ownerId = (0, exports.getTaskOwnerId)(task);
    if (ownerId === userId) {
        return { isOwner: true, canView: true, canComment: true, canManage: true, role: 'OWNER' };
    }
    if (!ownerId || task?.isPrivate === true || task?.visibility === Task_1.TaskVisibility.PRIVATE) {
        return { isOwner: false, canView: false, canComment: false, canManage: false, role: 'NONE' };
    }
    let hasExplicitAccess = (0, exports.getExplicitMonitorIds)(task).includes(userId);
    if (task?.visibility === Task_1.TaskVisibility.WORKSPACE && task?.workspaceId) {
        const workspaceAccess = await Workspace_1.Workspace.exists({
            _id: (0, exports.getIdString)(task.workspaceId),
            collaboratorIds: userId,
        });
        hasExplicitAccess = hasExplicitAccess || Boolean(workspaceAccess);
    }
    const active = hasExplicitAccess && await (0, exports.canRelationshipMonitor)(ownerId, userId);
    if (!active) {
        return { isOwner: false, canView: false, canComment: false, canManage: false, role: 'NONE' };
    }
    return { isOwner: false, canView: true, canComment: true, canManage: false, role: 'MONITOR' };
};
exports.getTaskPermissions = getTaskPermissions;
const canAccessTask = async (task, userId) => (await (0, exports.getTaskPermissions)(task, userId)).canView;
exports.canAccessTask = canAccessTask;
