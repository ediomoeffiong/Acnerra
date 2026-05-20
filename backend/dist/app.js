"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const profileRoutes_1 = __importDefault(require("./routes/profileRoutes"));
const app = (0, express_1.default)();
// Allowed CORS origins
const allowedOrigins = [
    'http://localhost:5173',
    'https://acnerra.vercel.app'
];
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin)
            return callback(null, true);
        // Check if origin is in allowedOrigins or matches FRONTEND_URL environment variable
        const isAllowed = allowedOrigins.includes(origin) || (process.env.FRONTEND_URL && process.env.FRONTEND_URL === origin);
        if (isAllowed) {
            callback(null, true);
        }
        else {
            callback(null, false); // Fail CORS validation gracefully
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Routes
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});
const errorMiddleware_1 = require("./middleware/errorMiddleware");
// Auth Routes
app.use('/api/v1/auth', authRoutes_1.default);
// Profile Routes
app.use('/api/v1/profiles', profileRoutes_1.default);
// Error handling middleware
app.use(errorMiddleware_1.errorHandler);
exports.default = app;
