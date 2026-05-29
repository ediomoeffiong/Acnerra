"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTaskCreator = exports.canAccessTask = exports.getTaskParticipantIds = exports.getIdString = void 0;
const getIdString = (value) => {
    if (!value)
        return null;
    if (value._id)
        return value._id.toString();
    return value.toString();
};
exports.getIdString = getIdString;
const getTaskParticipantIds = (task) => {
    if (task.isPrivate) {
        return [(0, exports.getIdString)(task.creatorId)].filter(Boolean);
    }
    const ids = [
        (0, exports.getIdString)(task.creatorId),
        (0, exports.getIdString)(task.partnerId),
        ...((task.collaboratorIds || []).map((id) => (0, exports.getIdString)(id))),
    ].filter(Boolean);
    return Array.from(new Set(ids));
};
exports.getTaskParticipantIds = getTaskParticipantIds;
const canAccessTask = (task, userId) => {
    return (0, exports.getTaskParticipantIds)(task).includes(userId);
};
exports.canAccessTask = canAccessTask;
const isTaskCreator = (task, userId) => {
    return (0, exports.getIdString)(task.creatorId) === userId;
};
exports.isTaskCreator = isTaskCreator;
