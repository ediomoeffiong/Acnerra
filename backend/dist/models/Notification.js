"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = exports.NotificationPriority = exports.NotificationCategory = void 0;
const mongoose_1 = require("mongoose");
var NotificationCategory;
(function (NotificationCategory) {
    NotificationCategory["TASKS"] = "TASKS";
    NotificationCategory["INVITES"] = "INVITES";
    NotificationCategory["FEEDBACK"] = "FEEDBACK";
    NotificationCategory["VERIFICATION"] = "VERIFICATION";
    NotificationCategory["REMINDERS"] = "REMINDERS";
})(NotificationCategory || (exports.NotificationCategory = NotificationCategory = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "LOW";
    NotificationPriority["NORMAL"] = "NORMAL";
    NotificationPriority["HIGH"] = "HIGH";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
const NotificationSchema = new mongoose_1.Schema({
    type: { type: String, required: true }, // e.g. "INVITE_RECEIVED", "TASK_COMPLETED", "PROGRESS_REQUEST", "VERIFICATION_REQUEST"
    category: {
        type: String,
        enum: Object.values(NotificationCategory),
        default: NotificationCategory.TASKS,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    priority: {
        type: String,
        enum: Object.values(NotificationPriority),
        default: NotificationPriority.NORMAL,
    },
    actionUrl: { type: String, default: null },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', default: null },
    inviteId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invite', default: null },
    partnerRelationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PartnerRelation', default: null },
    progressRequestId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProgressRequest', default: null },
}, { timestamps: true });
NotificationSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
NotificationSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
exports.Notification = (0, mongoose_1.model)('Notification', NotificationSchema);
