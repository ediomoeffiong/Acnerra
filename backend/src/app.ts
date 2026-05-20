import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';

const app = express();

// Allowed CORS origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://acnerra.vercel.app'
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowedOrigins or matches FRONTEND_URL environment variable
    const isAllowed = allowedOrigins.includes(origin) || (process.env.FRONTEND_URL && process.env.FRONTEND_URL === origin);
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false); // Fail CORS validation gracefully
    }
  },
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
