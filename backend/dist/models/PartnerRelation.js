"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerRelation = exports.PartnerStatus = exports.PartnerMode = void 0;
const mongoose_1 = require("mongoose");
var PartnerMode;
(function (PartnerMode) {
    PartnerMode["MUTUAL"] = "MUTUAL";
    PartnerMode["SINGLE"] = "SINGLE";
})(PartnerMode || (exports.PartnerMode = PartnerMode = {}));
var PartnerStatus;
(function (PartnerStatus) {
    PartnerStatus["PENDING"] = "PENDING";
    PartnerStatus["ACCEPTED"] = "ACCEPTED";
    PartnerStatus["DECLINED"] = "DECLINED";
    PartnerStatus["TERMINATED"] = "TERMINATED";
    PartnerStatus["CANCELLED"] = "CANCELLED";
})(PartnerStatus || (exports.PartnerStatus = PartnerStatus = {}));
const PartnerRelationSchema = new mongoose_1.Schema({
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    mode: { type: String, enum: Object.values(PartnerMode), required: true },
    status: { type: String, enum: Object.values(PartnerStatus), default: PartnerStatus.PENDING },
    respondedAt: { type: Date, default: null },
    terminatedAt: { type: Date, default: null },
    terminatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
// Convert _id to id for frontend compatibility
PartnerRelationSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
PartnerRelationSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
// Indexes
PartnerRelationSchema.index({ senderId: 1 });
PartnerRelationSchema.index({ receiverId: 1 });
PartnerRelationSchema.index({ status: 1 });
PartnerRelationSchema.index({ senderId: 1, receiverId: 1, status: 1 }, { partialFilterExpression: { status: { $in: [PartnerStatus.PENDING, PartnerStatus.ACCEPTED] } } });
exports.PartnerRelation = (0, mongoose_1.model)('PartnerRelation', PartnerRelationSchema);
