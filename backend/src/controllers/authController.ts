import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User';
import { encrypt, SESSION_DURATION } from '../lib/auth';

const RegisterSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

const LoginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

export const register = async (req: Request, res: Response) => {
  const validatedFields = RegisterSchema.safeParse(req.body);

  if (!validatedFields.success) {
    return res.status(400).json({
      errors: validatedFields.error.flatten().fieldErrors,
    });
  }

  const { username, email, password, name } = validatedFields.data;

  try {
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User with this email or username already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await new User({
      username,
      email,
      password: hashedPassword,
      name,
    }).save();

    const expires = new Date(Date.now() + SESSION_DURATION);
    const session = await encrypt({ userId: user._id.toString(), expires });

    res.cookie('session', session, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "An error occurred during registration.",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  const validatedFields = LoginSchema.safeParse(req.body);

  if (!validatedFields.success) {
    return res.status(400).json({
      errors: validatedFields.error.flatten().fieldErrors,
    });
  }

  const { identifier, password } = validatedFields.data;

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid credentials.",
      });
    }

    const expires = new Date(Date.now() + SESSION_DURATION);
    const session = await encrypt({ userId: user._id.toString(), expires });

    res.cookie('session', session, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "An error occurred during login.",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('session', {
    path: '/',
  });
  return res.status(200).json({ message: "Logged out successfully" });
};

export const me = async (req: any, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const user = await User.findById(req.user.userId).select('id username email name');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: user.toJSON() });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
