"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckIn = exports.CheckInStatus = void 0;
const mongoose_1 = require("mongoose");
var CheckInStatus;
(function (CheckInStatus) {
    CheckInStatus["COMPLETED"] = "COMPLETED";
    CheckInStatus["IN_PROGRESS"] = "IN_PROGRESS";
    CheckInStatus["MISSED"] = "MISSED";
})(CheckInStatus || (exports.CheckInStatus = CheckInStatus = {}));
const CheckInSchema = new mongoose_1.Schema({
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: Object.values(CheckInStatus), required: true },
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
CheckInSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
CheckInSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
CheckInSchema.index({ taskId: 1 });
CheckInSchema.index({ userId: 1 });
CheckInSchema.index({ taskId: 1, createdAt: -1 });
exports.CheckIn = (0, mongoose_1.model)('CheckIn', CheckInSchema);
