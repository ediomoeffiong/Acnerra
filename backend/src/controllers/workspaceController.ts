import { Response } from 'express';
import { Workspace } from '../models/Workspace';
import { Task } from '../models/Task';

// Fetch all workspaces for the logged-in user. Seed defaults if empty.
export const getWorkspaces = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    let workspaces = await Workspace.find({ userId: req.user.userId }).sort({ createdAt: 1 });
    
    // Automatically seed Personal and Work if none exist
    if (workspaces.length === 0) {
      const personal = await Workspace.create({
        name: "Personal",
        userId: req.user.userId,
        isDefault: true
      });
      const work = await Workspace.create({
        name: "Work",
        userId: req.user.userId,
        isDefault: true
      });
      workspaces = [personal, work];
    }

    return res.status(200).json({ workspaces: workspaces.map(w => w.toJSON()) });
  } catch (error) {
    console.error("Get workspaces error:", error);
    return res.status(500).json({ message: "An error occurred while retrieving workspaces." });
  }
};

// Create a new custom workspace
export const createWorkspace = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: "Workspace name is required." });
  }

  try {
    const workspace = await Workspace.create({
      name: name.trim(),
      userId: req.user.userId,
      isDefault: false
    });

    return res.status(201).json({
      message: "Workspace created successfully",
      workspace: workspace.toJSON()
    });
  } catch (error) {
    console.error("Create workspace error:", error);
    return res.status(500).json({ message: "An error occurred while creating the workspace." });
  }
};

// Rename an existing workspace
export const updateWorkspace = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: "Workspace name is required." });
  }

  try {
    const workspace = await Workspace.findOne({ _id: id, userId: req.user.userId });
    
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }

    workspace.name = name.trim();
    await workspace.save();

    return res.status(200).json({
      message: "Workspace updated successfully",
      workspace: workspace.toJSON()
    });
  } catch (error) {
    console.error("Update workspace error:", error);
    return res.status(500).json({ message: "An error occurred while updating the workspace." });
  }
};

// Delete a workspace and set associated tasks to null workspaceId
export const deleteWorkspace = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { id } = req.params;

  try {
    const workspace = await Workspace.findOne({ _id: id, userId: req.user.userId });
    
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }

    await Workspace.deleteOne({ _id: id });

    // Disassociate tasks from the deleted workspace
    await Task.updateMany({ workspaceId: id }, { $set: { workspaceId: null } });

    return res.status(200).json({
      message: "Workspace deleted successfully."
    });
  } catch (error) {
    console.error("Delete workspace error:", error);
    return res.status(500).json({ message: "An error occurred while deleting the workspace." });
  }
};

// Restore default workspaces ("Personal" and "Work")
export const restoreDefaultWorkspaces = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const userId = req.user.userId;

    const existingPersonal = await Workspace.findOne({ name: "Personal", userId });
    const existingWork = await Workspace.findOne({ name: "Work", userId });

    if (!existingPersonal) {
      await Workspace.create({ name: "Personal", userId, isDefault: true });
    }
    if (!existingWork) {
      await Workspace.create({ name: "Work", userId, isDefault: true });
    }

    const allWorkspaces = await Workspace.find({ userId }).sort({ createdAt: 1 });

    return res.status(200).json({
      message: "Default workspaces restored successfully.",
      workspaces: allWorkspaces.map(w => w.toJSON())
    });
  } catch (error) {
    console.error("Restore default workspaces error:", error);
    return res.status(500).json({ message: "An error occurred while restoring default workspaces." });
  }
};
