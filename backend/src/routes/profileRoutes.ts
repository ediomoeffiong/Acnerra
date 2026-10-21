import { Router } from 'express';
import { getProfileByUsername, updateProfile, searchProfiles } from '../controllers/profileController';
import { getPartners, sendPartnerInvite, acceptPartnerInvite, declinePartnerInvite, removePartner } from '../controllers/partnerController';
import { authMiddleware } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimit';
import { validateObjectId } from '../middleware/validateObjectId';

const router = Router();

// Protected routes for accountability partners
router.get('/partners', authMiddleware, getPartners);
router.post('/partners/invite', authMiddleware, rateLimit('partner-invite', 30, 15 * 60 * 1000), sendPartnerInvite);
router.post('/partners/accept/:id', authMiddleware, validateObjectId('id'), acceptPartnerInvite);
router.post('/partners/decline/:id', authMiddleware, validateObjectId('id'), declinePartnerInvite);
router.delete('/partners/:partnerId', authMiddleware, validateObjectId('partnerId'), removePartner);

// Protected route to search profiles by username or email
router.get('/', authMiddleware, searchProfiles);

// Public route to view any user profile
router.get('/:username', getProfileByUsername);

// Protected route to update the current user's profile
router.put('/me', authMiddleware, updateProfile);

export default router;
