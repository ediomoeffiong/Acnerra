import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { Task, TaskStatus } from '../models/Task';

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
        streakDays: Math.min(14, completedTasksCount * 2), // Mock/realistic stats since we don't build analytics
        consistencyRank: completedTasksCount >= 5 ? "Elite Partner" : "Active Partner"
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
