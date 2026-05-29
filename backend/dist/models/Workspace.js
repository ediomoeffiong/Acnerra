"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const mongoose_1 = require("mongoose");
const WorkspaceSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    isDefault: { type: Boolean, default: false },
    collaboratorIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });
// Convert _id to id for frontend compatibility
WorkspaceSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
WorkspaceSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
// Index for query speed
WorkspaceSchema.index({ userId: 1 });
WorkspaceSchema.index({ collaboratorIds: 1 });
exports.Workspace = (0, mongoose_1.model)('Workspace', WorkspaceSchema);
