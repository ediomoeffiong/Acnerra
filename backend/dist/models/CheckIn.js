"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckIn = void 0;
const mongoose_1 = require("mongoose");
const CheckInSchema = new mongoose_1.Schema({
    content: { type: String, trim: true, default: '' },
    status: { type: String, default: null }, // e.g. feeling good, struggling, etc.
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
exports.CheckIn = (0, mongoose_1.model)('CheckIn', CheckInSchema);
