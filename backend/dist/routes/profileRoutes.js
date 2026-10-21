"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profileController_1 = require("../controllers/profileController");
const partnerController_1 = require("../controllers/partnerController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const rateLimit_1 = require("../middleware/rateLimit");
const validateObjectId_1 = require("../middleware/validateObjectId");
const router = (0, express_1.Router)();
// Protected routes for accountability partners
router.get('/partners', authMiddleware_1.authMiddleware, partnerController_1.getPartners);
router.post('/partners/invite', authMiddleware_1.authMiddleware, (0, rateLimit_1.rateLimit)('partner-invite', 30, 15 * 60 * 1000), partnerController_1.sendPartnerInvite);
router.post('/partners/accept/:id', authMiddleware_1.authMiddleware, (0, validateObjectId_1.validateObjectId)('id'), partnerController_1.acceptPartnerInvite);
router.post('/partners/decline/:id', authMiddleware_1.authMiddleware, (0, validateObjectId_1.validateObjectId)('id'), partnerController_1.declinePartnerInvite);
router.delete('/partners/:partnerId', authMiddleware_1.authMiddleware, (0, validateObjectId_1.validateObjectId)('partnerId'), partnerController_1.removePartner);
// Protected route to update onboarding state
router.patch('/onboarding', authMiddleware_1.authMiddleware, profileController_1.updateOnboardingState);
// Protected route to search profiles by username or email
router.get('/', authMiddleware_1.authMiddleware, profileController_1.searchProfiles);
// Public route to view any user profile
router.get('/:username', profileController_1.getProfileByUsername);
// Protected route to update the current user's profile
router.put('/me', authMiddleware_1.authMiddleware, profileController_1.updateProfile);
exports.default = router;
