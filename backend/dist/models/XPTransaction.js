"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XPTransaction = exports.XPReason = void 0;
const mongoose_1 = require("mongoose");
var XPReason;
(function (XPReason) {
    XPReason["TASK_COMPLETED"] = "TASK_COMPLETED";
    XPReason["MILESTONE_COMPLETED"] = "MILESTONE_COMPLETED";
    XPReason["CHECK_IN_SUBMITTED"] = "CHECK_IN_SUBMITTED";
    XPReason["RECURRING_TASK_COMPLETED"] = "RECURRING_TASK_COMPLETED";
})(XPReason || (exports.XPReason = XPReason = {}));
const XPTransactionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    reason: { type: String, enum: Object.values(XPReason), required: true },
    referenceId: { type: String, required: true },
}, { timestamps: true });
XPTransactionSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
XPTransactionSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
// Idempotent compound index to prevent duplicate awards for same task/checkin/milestone
XPTransactionSchema.index({ userId: 1, reason: 1, referenceId: 1 }, { unique: true });
exports.XPTransaction = (0, mongoose_1.model)('XPTransaction', XPTransactionSchema);
