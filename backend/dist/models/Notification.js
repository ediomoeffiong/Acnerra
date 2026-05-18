"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const NotificationSchema = new mongoose_1.Schema({
    type: { type: String, required: true }, // e.g. "INVITE_RECEIVED", "TASK_COMPLETED"
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
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
exports.Notification = (0, mongoose_1.model)('Notification', NotificationSchema);
