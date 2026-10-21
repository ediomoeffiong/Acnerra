"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressRequest = exports.ProgressRequestStatus = void 0;
const mongoose_1 = require("mongoose");
var ProgressRequestStatus;
(function (ProgressRequestStatus) {
    ProgressRequestStatus["PENDING"] = "PENDING";
    ProgressRequestStatus["RESPONDED"] = "RESPONDED";
    ProgressRequestStatus["MUTED"] = "MUTED";
})(ProgressRequestStatus || (exports.ProgressRequestStatus = ProgressRequestStatus = {}));
const ProgressRequestSchema = new mongoose_1.Schema({
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', required: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    requesterId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: Object.values(ProgressRequestStatus),
        default: ProgressRequestStatus.PENDING,
    },
    message: { type: String, trim: true, default: '' },
    requestedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    responseNotes: { type: String, trim: true, default: '' },
}, { timestamps: true });
ProgressRequestSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
ProgressRequestSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
ProgressRequestSchema.index({ taskId: 1, requesterId: 1, status: 1 });
ProgressRequestSchema.index({ ownerId: 1, status: 1 });
ProgressRequestSchema.index({ taskId: 1, createdAt: -1 });
exports.ProgressRequest = (0, mongoose_1.model)('ProgressRequest', ProgressRequestSchema);
