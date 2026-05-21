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
    'http://localhost:3000',
    'https://acnerra.vercel.app'
];
// Helper to validate origin
const isOriginAllowed = (origin) => {
    if (!origin)
        return true; // Allow requests with no origin (like mobile apps, curl, postman)
    if (allowedOrigins.includes(origin))
        return true;
    if (process.env.FRONTEND_URL && process.env.FRONTEND_URL === origin)
        return true;
    // Allow any localhost port in development
    if (/^http:\/\/localhost:\d+$/.test(origin))
        return true;
    // Allow Vercel preview deployment URLs dynamically
    if (/^https:\/\/acnerra-.*\.vercel\.app$/.test(origin))
        return true;
    return false;
};
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
        }
        else {
            callback(null, false); // Fail CORS validation gracefully
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
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
