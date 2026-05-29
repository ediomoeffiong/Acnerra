"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskController_1 = require("../controllers/taskController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validateObjectId_1 = require("../middleware/validateObjectId");
const router = (0, express_1.Router)();
// All task routes are protected by authMiddleware
router.use(authMiddleware_1.authMiddleware);
// CRUD operations on tasks
router.post('/', taskController_1.createTask);
router.get('/', taskController_1.getTasks);
router.get('/dashboard', taskController_1.getDashboardData);
// ID-parameterized routes
router.get('/:id', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.getTaskById);
router.put('/:id', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.updateTask);
router.delete('/:id', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.deleteTask);
router.delete('/:id/partners/:partnerId', (0, validateObjectId_1.validateObjectId)('id'), (0, validateObjectId_1.validateObjectId)('partnerId'), taskController_1.removeCollaboratorFromTask);
exports.default = router;
