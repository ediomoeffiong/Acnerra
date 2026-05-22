"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Invite = exports.InviteStatus = void 0;
const mongoose_1 = require("mongoose");
var InviteStatus;
(function (InviteStatus) {
    InviteStatus["PENDING"] = "PENDING";
    InviteStatus["ACCEPTED"] = "ACCEPTED";
    InviteStatus["DECLINED"] = "DECLINED";
    InviteStatus["EXPIRED"] = "EXPIRED";
})(InviteStatus || (exports.InviteStatus = InviteStatus = {}));
const InviteSchema = new mongoose_1.Schema({
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(InviteStatus), default: InviteStatus.PENDING },
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', required: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
    respondedAt: { type: Date, default: null },
}, { timestamps: true });
InviteSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
InviteSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
// Indexes
InviteSchema.index({ senderId: 1 });
InviteSchema.index({ receiverId: 1 });
InviteSchema.index({ taskId: 1 });
InviteSchema.index({ senderId: 1, receiverId: 1, taskId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: InviteStatus.PENDING } });
exports.Invite = (0, mongoose_1.model)('Invite', InviteSchema);
