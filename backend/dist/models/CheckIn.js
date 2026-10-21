"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckIn = exports.EvidenceType = exports.CheckInKind = exports.CheckInStatus = void 0;
const mongoose_1 = require("mongoose");
var CheckInStatus;
(function (CheckInStatus) {
    CheckInStatus["COMPLETED"] = "COMPLETED";
    CheckInStatus["IN_PROGRESS"] = "IN_PROGRESS";
    CheckInStatus["MISSED"] = "MISSED";
})(CheckInStatus || (exports.CheckInStatus = CheckInStatus = {}));
var CheckInKind;
(function (CheckInKind) {
    CheckInKind["OWNER_PROGRESS"] = "OWNER_PROGRESS";
    CheckInKind["PARTNER_FEEDBACK"] = "PARTNER_FEEDBACK";
})(CheckInKind || (exports.CheckInKind = CheckInKind = {}));
var EvidenceType;
(function (EvidenceType) {
    EvidenceType["LINK"] = "LINK";
    EvidenceType["IMAGE"] = "IMAGE";
    EvidenceType["DOCUMENT"] = "DOCUMENT";
})(EvidenceType || (exports.EvidenceType = EvidenceType = {}));
const EvidenceSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    type: { type: String, enum: Object.values(EvidenceType), required: true },
    url: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, default: null },
    mimeType: { type: String, default: null },
    storageKey: { type: String, default: null },
}, { _id: false });
const CheckInSchema = new mongoose_1.Schema({
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: Object.values(CheckInStatus), required: true },
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: Object.values(CheckInKind), default: null },
    // Stage 2 Advanced Progress Tracking
    progress: { type: Number, min: 0, max: 100, default: null },
    completedWork: { type: String, trim: true, default: '' },
    blockers: { type: String, trim: true, default: '' },
    nextSteps: { type: String, trim: true, default: '' },
    isPrivate: { type: Boolean, default: false }, // Private partner feedback only seen by author & task owner
    evidence: [EvidenceSchema],
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
