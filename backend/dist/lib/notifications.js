"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = void 0;
const Notification_1 = require("../models/Notification");
const createNotification = async (input) => {
    return Notification_1.Notification.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        taskId: input.taskId || null,
        inviteId: input.inviteId || null,
    });
};
exports.createNotification = createNotification;
