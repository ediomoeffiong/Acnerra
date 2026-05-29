"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePartnerFromWorkspace = exports.restoreDefaultWorkspaces = exports.deleteWorkspace = exports.updateWorkspace = exports.createWorkspace = exports.getWorkspaces = void 0;
const Workspace_1 = require("../models/Workspace");
const Task_1 = require("../models/Task");
const PartnerRelation_1 = require("../models/PartnerRelation");
// Fetch all workspaces for the logged-in user. Seed defaults if empty.
const getWorkspaces = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    const userId = req.user.userId;
    try {
        // Seed defaults if user has no workspaces
        let userWorkspaces = await Workspace_1.Workspace.find({ userId });
        if (userWorkspaces.length === 0) {
            await Workspace_1.Workspace.create({
                name: "Personal",
                userId,
                isDefault: true
            });
            await Workspace_1.Workspace.create({
                name: "Work",
                userId,
                isDefault: true
            });
        }
        // Find mutual partners
        const mutualRelations = await PartnerRelation_1.PartnerRelation.find({
            status: PartnerRelation_1.PartnerStatus.ACCEPTED,
            mode: PartnerRelation_1.PartnerMode.MUTUAL,
            $or: [{ senderId: userId }, { receiverId: userId }]
        });
        const mutualPartnerIds = mutualRelations.map(r => r.senderId.toString() === userId ? r.receiverId : r.senderId);
        // Fetch workspaces for user + workspaces where they are added as collaborator
        const workspaces = await Workspace_1.Workspace.find({
            $or: [
                { userId },
                { collaboratorIds: userId }
            ]
        }).populate('userId', 'id username name image')
            .populate('collaboratorIds', 'id username name image')
            .sort({ createdAt: 1 });
        return res.status(200).json({ workspaces: workspaces.map(w => w.toJSON()) });
    }
    catch (error) {
        console.error("Get workspaces error:", error);
        return res.status(500).json({ message: "An error occurred while retrieving workspaces." });
    }
};
exports.getWorkspaces = getWorkspaces;
// Create a new custom workspace
const createWorkspace = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Workspace name is required." });
    }
    const nameTrimmed = name.trim();
    try {
        // Workspace name uniqueness check (case-insensitive per-user)
        const duplicate = await Workspace_1.Workspace.findOne({
            userId: req.user.userId,
            name: { $regex: new RegExp(`^${nameTrimmed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
        if (duplicate) {
            return res.status(400).json({ message: "A workspace with this name already exists." });
        }
        const workspace = await Workspace_1.Workspace.create({
            name: nameTrimmed,
            userId: req.user.userId,
            isDefault: false
        });
        return res.status(201).json({
            message: "Workspace created successfully",
            workspace: workspace.toJSON()
        });
    }
    catch (error) {
        console.error("Create workspace error:", error);
        return res.status(500).json({ message: "An error occurred while creating the workspace." });
    }
};
exports.createWorkspace = createWorkspace;
// Rename an existing workspace
const updateWorkspace = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Workspace name is required." });
    }
    const nameTrimmed = name.trim();
    try {
        const workspace = await Workspace_1.Workspace.findOne({ _id: id, userId: req.user.userId });
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found." });
        }
        // Workspace name uniqueness check (case-insensitive per-user)
        const duplicate = await Workspace_1.Workspace.findOne({
            _id: { $ne: id },
            userId: req.user.userId,
            name: { $regex: new RegExp(`^${nameTrimmed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
        if (duplicate) {
            return res.status(400).json({ message: "A workspace with this name already exists." });
        }
        workspace.name = nameTrimmed;
        await workspace.save();
        return res.status(200).json({
            message: "Workspace updated successfully",
            workspace: workspace.toJSON()
        });
    }
    catch (error) {
        console.error("Update workspace error:", error);
        return res.status(500).json({ message: "An error occurred while updating the workspace." });
    }
};
exports.updateWorkspace = updateWorkspace;
// Delete a workspace and set associated tasks to null workspaceId
const deleteWorkspace = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    const { id } = req.params;
    try {
        const workspace = await Workspace_1.Workspace.findOne({ _id: id, userId: req.user.userId });
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found." });
        }
        await Workspace_1.Workspace.deleteOne({ _id: id });
        // Disassociate tasks from the deleted workspace
        await Task_1.Task.updateMany({ workspaceId: id }, { $set: { workspaceId: null } });
        return res.status(200).json({
            message: "Workspace deleted successfully."
        });
    }
    catch (error) {
        console.error("Delete workspace error:", error);
        return res.status(500).json({ message: "An error occurred while deleting the workspace." });
    }
};
exports.deleteWorkspace = deleteWorkspace;
// Restore default workspaces ("Personal" and "Work")
const restoreDefaultWorkspaces = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    try {
        const userId = req.user.userId;
        const existingPersonal = await Workspace_1.Workspace.findOne({ name: "Personal", userId });
        const existingWork = await Workspace_1.Workspace.findOne({ name: "Work", userId });
        if (!existingPersonal) {
            await Workspace_1.Workspace.create({ name: "Personal", userId, isDefault: true });
        }
        if (!existingWork) {
            await Workspace_1.Workspace.create({ name: "Work", userId, isDefault: true });
        }
        const allWorkspaces = await Workspace_1.Workspace.find({ userId }).sort({ createdAt: 1 });
        return res.status(200).json({
            message: "Default workspaces restored successfully.",
            workspaces: allWorkspaces.map(w => w.toJSON())
        });
    }
    catch (error) {
        console.error("Restore default workspaces error:", error);
        return res.status(500).json({ message: "An error occurred while restoring default workspaces." });
    }
};
exports.restoreDefaultWorkspaces = restoreDefaultWorkspaces;
// Remove partner collaborator from workspace
const removePartnerFromWorkspace = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    const { id, partnerId } = req.params;
    try {
        const workspace = await Workspace_1.Workspace.findOne({ _id: id, userId: req.user.userId });
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found." });
        }
        workspace.collaboratorIds = (workspace.collaboratorIds || []).filter(cid => cid.toString() !== partnerId);
        await workspace.save();
        return res.status(200).json({
            message: "Partner removed from workspace successfully.",
            workspace: workspace.toJSON()
        });
    }
    catch (error) {
        console.error("Remove partner from workspace error:", error);
        return res.status(500).json({ message: "An error occurred while removing partner from workspace." });
    }
};
exports.removePartnerFromWorkspace = removePartnerFromWorkspace;
