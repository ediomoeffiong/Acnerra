import { Router } from 'express';
import { getProfileByUsername, updateProfile, searchProfiles } from '../controllers/profileController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protected route to search profiles by username or email
router.get('/', authMiddleware, searchProfiles);

// Public route to view any user profile
router.get('/:username', getProfileByUsername);

// Protected route to update the current user's profile
router.put('/me', authMiddleware, updateProfile);

export default router;
