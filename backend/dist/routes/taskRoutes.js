"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const taskController_1 = require("../controllers/taskController");
const progressRequestController_1 = require("../controllers/progressRequestController");
const checkInController_1 = require("../controllers/checkInController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validateObjectId_1 = require("../middleware/validateObjectId");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
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
// Timeline
router.get('/:id/timeline', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.getTaskTimeline);
// Subtasks
router.post('/:id/subtasks', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.addSubtask);
router.put('/:id/subtasks/:subtaskId', (0, validateObjectId_1.validateObjectId)('id'), (0, validateObjectId_1.validateObjectId)('subtaskId'), taskController_1.updateSubtask);
router.delete('/:id/subtasks/:subtaskId', (0, validateObjectId_1.validateObjectId)('id'), (0, validateObjectId_1.validateObjectId)('subtaskId'), taskController_1.deleteSubtask);
router.patch('/:id/subtasks/:subtaskId/toggle', (0, validateObjectId_1.validateObjectId)('id'), (0, validateObjectId_1.validateObjectId)('subtaskId'), taskController_1.toggleSubtask);
// Milestones
router.post('/:id/milestones', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.addMilestone);
router.put('/:id/milestones/:milestoneId', (0, validateObjectId_1.validateObjectId)('id'), (0, validateObjectId_1.validateObjectId)('milestoneId'), taskController_1.updateMilestone);
router.delete('/:id/milestones/:milestoneId', (0, validateObjectId_1.validateObjectId)('id'), (0, validateObjectId_1.validateObjectId)('milestoneId'), taskController_1.deleteMilestone);
// Reschedule
router.post('/:id/reschedule', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.rescheduleTask);
// Completion Verification
router.post('/:id/verify', (0, validateObjectId_1.validateObjectId)('id'), taskController_1.verifyTaskCompletion);
// Progress Requests
router.post('/:taskId/progress-requests', (0, validateObjectId_1.validateObjectId)('taskId'), progressRequestController_1.createProgressRequest);
router.get('/:taskId/progress-requests', (0, validateObjectId_1.validateObjectId)('taskId'), progressRequestController_1.listProgressRequests);
router.patch('/:taskId/progress-requests/:requestId/respond', (0, validateObjectId_1.validateObjectId)('taskId'), (0, validateObjectId_1.validateObjectId)('requestId'), progressRequestController_1.respondToProgressRequest);
router.patch('/:taskId/progress-requests/:requestId/mute', (0, validateObjectId_1.validateObjectId)('taskId'), (0, validateObjectId_1.validateObjectId)('requestId'), progressRequestController_1.muteProgressRequest);
// Evidence upload & download
router.post('/:taskId/evidence/upload', (0, validateObjectId_1.validateObjectId)('taskId'), upload.single('file'), checkInController_1.uploadEvidenceFile);
router.get('/:taskId/evidence/:storageKey/download', (0, validateObjectId_1.validateObjectId)('taskId'), checkInController_1.downloadEvidenceFile);
exports.default = router;
