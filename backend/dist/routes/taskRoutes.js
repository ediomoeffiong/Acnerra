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
// ID-parameterized routes
router.get('/:id', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.getTaskById);
router.put('/:id', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.updateTask);
router.delete('/:id', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.deleteTask);
exports.default = router;
