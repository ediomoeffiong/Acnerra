"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = exports.TaskVisibility = exports.TaskPriority = exports.TaskStatus = void 0;
const mongoose_1 = require("mongoose");
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "PENDING";
    TaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TaskStatus["MISSED"] = "MISSED";
    TaskStatus["COMPLETED"] = "COMPLETED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "LOW";
    TaskPriority["MEDIUM"] = "MEDIUM";
    TaskPriority["HIGH"] = "HIGH";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var TaskVisibility;
(function (TaskVisibility) {
    TaskVisibility["PRIVATE"] = "PRIVATE";
    TaskVisibility["SELECTED_PARTNERS"] = "SELECTED_PARTNERS";
    TaskVisibility["WORKSPACE"] = "WORKSPACE";
})(TaskVisibility || (exports.TaskVisibility = TaskVisibility = {}));
const TaskSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    status: { type: String, enum: Object.values(TaskStatus), default: TaskStatus.PENDING },
    priority: { type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM },
    dueDate: { type: Date, default: null },
    // ownerId is authoritative. creatorId is retained as an immutable historical field
    // and as a compatibility fallback until the Stage 1 migration has run.
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    creatorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    partnerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    collaboratorIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    sharedWithIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    visibility: { type: String, enum: Object.values(TaskVisibility), default: TaskVisibility.PRIVATE },
    isPrivate: { type: Boolean, default: true },
    workspaceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    sharingMigratedAt: { type: Date, default: null },
}, { timestamps: true });
TaskSchema.pre('validate', function () {
    if (!this.ownerId && this.creatorId)
        this.ownerId = this.creatorId;
});
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
TaskSchema.index({ ownerId: 1 });
TaskSchema.index({ partnerId: 1 });
TaskSchema.index({ collaboratorIds: 1 });
TaskSchema.index({ sharedWithIds: 1 });
TaskSchema.index({ workspaceId: 1 });
exports.Task = (0, mongoose_1.model)('Task', TaskSchema);
