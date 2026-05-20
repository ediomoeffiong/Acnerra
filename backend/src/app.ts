import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

import { errorHandler } from './middleware/errorMiddleware';

// Auth Routes
app.use('/api/v1/auth', authRoutes);

// Profile Routes
app.use('/api/v1/profiles', profileRoutes);

// Error handling middleware
app.use(errorHandler);

export default app;
