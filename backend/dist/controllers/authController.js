"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.logout = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const User_1 = require("../models/User");
const auth_1 = require("../lib/auth");
const RegisterSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, "Username must be at least 3 characters").max(20),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    name: zod_1.z.string().optional(),
});
const LoginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1, "Username or email is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
const register = async (req, res) => {
    const validatedFields = RegisterSchema.safeParse(req.body);
    if (!validatedFields.success) {
        return res.status(400).json({
            errors: validatedFields.error.flatten().fieldErrors,
        });
    }
    const { username, email, password, name } = validatedFields.data;
    try {
        const existingUser = await User_1.User.findOne({
            $or: [{ email }, { username }],
        });
        if (existingUser) {
            return res.status(400).json({
                message: "User with this email or username already exists.",
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = await new User_1.User({
            username,
            email,
            password: hashedPassword,
            name,
        }).save();
        const expires = new Date(Date.now() + auth_1.SESSION_DURATION);
        const session = await (0, auth_1.encrypt)({ userId: user._id.toString(), expires });
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
        res.cookie('session', session, {
            expires,
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        });
        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                name: user.name,
                bio: user.bio,
                image: user.image,
            },
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({
            message: "An error occurred during registration.",
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    const validatedFields = LoginSchema.safeParse(req.body);
    if (!validatedFields.success) {
        return res.status(400).json({
            errors: validatedFields.error.flatten().fieldErrors,
        });
    }
    const { identifier, password } = validatedFields.data;
    try {
        const user = await User_1.User.findOne({
            $or: [{ email: identifier }, { username: identifier }],
        });
        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials.",
            });
        }
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid credentials.",
            });
        }
        const expires = new Date(Date.now() + auth_1.SESSION_DURATION);
        const session = await (0, auth_1.encrypt)({ userId: user._id.toString(), expires });
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
        res.cookie('session', session, {
            expires,
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        });
        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                name: user.name,
                bio: user.bio,
                image: user.image,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "An error occurred during login.",
        });
    }
};
exports.login = login;
const logout = async (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    res.clearCookie('session', {
        path: '/',
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    });
    return res.status(200).json({ message: "Logged out successfully" });
};
exports.logout = logout;
const me = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    try {
        const user = await User_1.User.findById(req.user.userId).select('id username email name bio image');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ user: user.toJSON() });
    }
    catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.me = me;
