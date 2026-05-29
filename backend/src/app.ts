import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import taskRoutes from './routes/taskRoutes';
import inviteRoutes from './routes/inviteRoutes';
import checkInRoutes from './routes/checkInRoutes';
import notificationRoutes from './routes/notificationRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import workspaceRoutes from './routes/workspaceRoutes';

const app = express();

// Trust proxy for secure cookies behind reverse proxy (Render)
app.set('trust proxy', 1);

// Allowed CORS origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://acnerra.vercel.app'
];

// Helper to validate origin
const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow requests with no origin (like mobile apps, curl, postman)
  
  if (allowedOrigins.includes(origin)) return true;
  
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL === origin) return true;
  
  // Allow any localhost port in development
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  
  // Allow Vercel preview deployment URLs dynamically
  if (/^https:\/\/acnerra-.*\.vercel\.app$/.test(origin)) return true;
  
  return false;
};

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false); // Fail CORS validation gracefully
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
  res.status(200).json({
    message: "Welcome to the Acnerra API",
    status: "healthy",
    version: "1.0.0"
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

import { errorHandler } from './middleware/errorMiddleware';

// DB connection check middleware for API endpoints
app.use('/api/v1', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: "Database connection is not active. Please ensure MONGO_URI or DATABASE_URL is correctly configured in your Render dashboard environment variables."
    });
  }
  next();
});

// Auth Routes
app.use('/api/v1/auth', authRoutes);

// Profile Routes
app.use('/api/v1/profiles', profileRoutes);

// Task Routes
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/tasks/:taskId/check-ins', checkInRoutes);
app.use('/api/v1/invites', inviteRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/workspaces', workspaceRoutes);

// Error handling middleware
app.use(errorHandler);

export default app;
