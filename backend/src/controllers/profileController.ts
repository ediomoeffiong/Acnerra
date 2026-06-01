import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { Task, TaskStatus } from '../models/Task';
import { PartnerRelation, PartnerStatus } from '../models/PartnerRelation';
import { calculateUserStreak } from '../lib/streak';

const ProfileUpdateSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .trim(),
  name: z.string().max(50, "Display name cannot exceed 50 characters").trim().optional().nullable(),
  bio: z.string().max(160, "Bio cannot exceed 160 characters").trim().optional().nullable(),
  image: z.string().trim().url("Invalid avatar image URL").or(z.literal("")).optional().nullable(),
});

export const getProfileByUsername = async (req: Request, res: Response) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } })
      .select('id username name bio image createdAt');

    if (!user) {
      return res.status(404).json({
        message: "User profile not found.",
      });
    }

    // Fetch real metrics from DB
    const completedTasksCount = await Task.countDocuments({ creatorId: user._id, status: TaskStatus.COMPLETED });
    const totalTasksCount = await Task.countDocuments({ creatorId: user._id });
    const streak = await calculateUserStreak(user._id.toString());
    const partnersCount = await PartnerRelation.countDocuments({
      status: PartnerStatus.ACCEPTED,
      $or: [{ senderId: user._id }, { receiverId: user._id }]
    });

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        name: user.name || '',
        bio: user.bio || '',
        image: user.image || '',
        createdAt: user.createdAt,
      },
      stats: {
        completedTasks: completedTasksCount,
        totalTasks: totalTasksCount,
        streakDays: streak.streakDays,
        streakDates: streak.streakDates,
        missedDates: streak.missedDates,
        partnersCount,
        consistencyRank: streak.streakDays >= 14 || completedTasksCount >= 10 ? "Elite Partner" : completedTasksCount >= 5 ? "Active Partner" : "Growing Partner"
      }
    });
  } catch (error) {
    console.error("Fetch profile error:", error);
    return res.status(500).json({
      message: "An error occurred while fetching the profile.",
    });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const validatedFields = ProfileUpdateSchema.safeParse(req.body);

  if (!validatedFields.success) {
    return res.status(400).json({
      errors: validatedFields.error.flatten().fieldErrors,
    });
  }

  const { username, name, bio, image } = validatedFields.data;
  const currentUserId = req.user.userId;

  try {
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // If changing username, check uniqueness
    if (username.toLowerCase() !== currentUser.username.toLowerCase()) {
      const existingUser = await User.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });

      if (existingUser && existingUser._id.toString() !== currentUserId) {
        return res.status(400).json({
          errors: {
            username: ["Username is already taken by another user."]
          }
        });
      }
    }

    // Perform update
    currentUser.username = username;
    currentUser.name = name || '';
    currentUser.bio = bio || '';
    currentUser.image = image || '';

    await currentUser.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: currentUser._id.toString(),
        username: currentUser.username,
        email: currentUser.email,
        name: currentUser.name,
        bio: currentUser.bio,
        image: currentUser.image,
      }
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      message: "An error occurred while updating the profile.",
    });
  }
};

// Search active profiles by username or email
export const searchProfiles = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const query = req.query.query;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(200).json({ profiles: [] });
  }

  try {
    const searchRegex = new RegExp(query.trim(), 'i');
    
    // Find matching users (exclude current user)
    const users = await User.find({
      _id: { $ne: req.user.userId },
      $or: [
        { username: { $regex: searchRegex } },
        { email: { $regex: searchRegex } }
      ]
    })
    .select('id username name bio image')
    .limit(10);

    return res.status(200).json({
      profiles: users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        name: u.name || '',
        image: u.image || '',
        bio: u.bio || ''
      }))
    });

  } catch (error) {
    console.error("Search profiles error:", error);
    return res.status(500).json({
      message: "An error occurred while searching profiles.",
    });
  }
};

// Retrieve user's accountability partners
export const getPartners = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const user = await User.findById(req.user.userId).populate('accountabilityPartners', 'id username name bio image');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ partners: user.accountabilityPartners || [] });
  } catch (error) {
    console.error("Get partners error:", error);
    return res.status(500).json({ message: "An error occurred while fetching partners." });
  }
};

// Add a user as an accountability partner
export const addPartner = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { partnerId } = req.body;
  if (!partnerId) {
    return res.status(400).json({ message: "Partner ID is required." });
  }

  if (partnerId === req.user.userId) {
    return res.status(400).json({ message: "You cannot add yourself as an accountability partner." });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const partner = await User.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner user not found." });
    }

    user.accountabilityPartners = user.accountabilityPartners || [];
    const isAlreadyPartner = user.accountabilityPartners.some(
      (id) => id.toString() === partnerId
    );

    if (isAlreadyPartner) {
      return res.status(400).json({ message: "User is already an accountability partner." });
    }

    user.accountabilityPartners.push(partnerId as any);
    await user.save();

    await user.populate('accountabilityPartners', 'id username name bio image');

    return res.status(200).json({
      message: "Partner added successfully.",
      partners: user.accountabilityPartners
    });
  } catch (error) {
    console.error("Add partner error:", error);
    return res.status(500).json({ message: "An error occurred while adding partner." });
  }
};

// Remove a user from accountability partners
export const removePartner = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { partnerId } = req.params;

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.accountabilityPartners = (user.accountabilityPartners || []).filter(
      (id) => id.toString() !== partnerId
    );
    
    await user.save();

    await user.populate('accountabilityPartners', 'id username name bio image');

    return res.status(200).json({
      message: "Partner removed successfully.",
      partners: user.accountabilityPartners
    });
  } catch (error) {
    console.error("Remove partner error:", error);
    return res.status(500).json({ message: "An error occurred while removing partner." });
  }
};
