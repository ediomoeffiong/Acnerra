import { Router } from 'express';
import { getProfileByUsername, updateProfile } from '../controllers/profileController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public route to view any user profile
router.get('/:username', getProfileByUsername);

// Protected route to update the current user's profile
router.put('/me', authMiddleware, updateProfile);

export default router;
