import { Router } from 'express';
import multer from 'multer';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getDashboardData,
  removeCollaboratorFromTask,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtask,
  addMilestone,
  updateMilestone,
  deleteMilestone,
  rescheduleTask,
  verifyTaskCompletion,
  getTaskTimeline,
} from '../controllers/taskController';
import {
  createProgressRequest,
  listProgressRequests,
  respondToProgressRequest,
  muteProgressRequest,
} from '../controllers/progressRequestController';
import {
  uploadEvidenceFile,
  downloadEvidenceFile,
} from '../controllers/checkInController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// All task routes are protected by authMiddleware
router.use(authMiddleware);

// CRUD operations on tasks
router.post('/', createTask);
router.get('/', getTasks);
router.get('/dashboard', getDashboardData);

// ID-parameterized routes
router.get('/:id', validateObjectId('id'), getTaskById);
router.put('/:id', validateObjectId('id'), updateTask);
router.delete('/:id', validateObjectId('id'), deleteTask);
router.delete('/:id/partners/:partnerId', validateObjectId('id'), validateObjectId('partnerId'), removeCollaboratorFromTask);

// Timeline
router.get('/:id/timeline', validateObjectId('id'), getTaskTimeline);

// Subtasks
router.post('/:id/subtasks', validateObjectId('id'), addSubtask);
router.put('/:id/subtasks/:subtaskId', validateObjectId('id'), validateObjectId('subtaskId'), updateSubtask);
router.delete('/:id/subtasks/:subtaskId', validateObjectId('id'), validateObjectId('subtaskId'), deleteSubtask);
router.patch('/:id/subtasks/:subtaskId/toggle', validateObjectId('id'), validateObjectId('subtaskId'), toggleSubtask);

// Milestones
router.post('/:id/milestones', validateObjectId('id'), addMilestone);
router.put('/:id/milestones/:milestoneId', validateObjectId('id'), validateObjectId('milestoneId'), updateMilestone);
router.delete('/:id/milestones/:milestoneId', validateObjectId('id'), validateObjectId('milestoneId'), deleteMilestone);

// Reschedule
router.post('/:id/reschedule', validateObjectId('id'), rescheduleTask);

// Completion Verification
router.post('/:id/verify', validateObjectId('id'), verifyTaskCompletion);

// Progress Requests
router.post('/:taskId/progress-requests', validateObjectId('taskId'), createProgressRequest);
router.get('/:taskId/progress-requests', validateObjectId('taskId'), listProgressRequests);
router.patch('/:taskId/progress-requests/:requestId/respond', validateObjectId('taskId'), validateObjectId('requestId'), respondToProgressRequest);
router.patch('/:taskId/progress-requests/:requestId/mute', validateObjectId('taskId'), validateObjectId('requestId'), muteProgressRequest);

// Evidence upload & download
router.post('/:taskId/evidence/upload', validateObjectId('taskId'), upload.single('file'), uploadEvidenceFile);
router.get('/:taskId/evidence/:storageKey/download', validateObjectId('taskId'), downloadEvidenceFile);

export default router;
