"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = exports.TaskStatus = void 0;
const mongoose_1 = require("mongoose");
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["TODO"] = "TODO";
    TaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TaskStatus["DONE"] = "DONE";
    TaskStatus["ARCHIVED"] = "ARCHIVED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
const TaskSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.TODO },
    dueDate: { type: Date, default: null },
    creatorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    partnerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
// Convert _id to id for frontend compatibility
TaskSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
TaskSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
// Indexes for high performance
TaskSchema.index({ creatorId: 1 });
TaskSchema.index({ partnerId: 1 });
exports.Task = (0, mongoose_1.model)('Task', TaskSchema);
