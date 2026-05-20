"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profileController_1 = require("../controllers/profileController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public route to view any user profile
router.get('/:username', profileController_1.getProfileByUsername);
// Protected route to update the current user's profile
router.put('/me', authMiddleware_1.authMiddleware, profileController_1.updateProfile);
exports.default = router;
