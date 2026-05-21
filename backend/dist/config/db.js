"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!uri) {
        console.error("WARNING: MONGO_URI or DATABASE_URL is not defined in environment variables. Database features will fail.");
        return;
    }
    try {
        const conn = await mongoose_1.default.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
    catch (error) {
        console.error("MongoDB connection error:", error);
        console.error("The server will continue running, but database operations will fail until connection is established.");
    }
};
exports.connectDB = connectDB;
