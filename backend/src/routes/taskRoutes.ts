import { Router } from 'express';
import { createTask, getTasks, getTaskById, updateTask, deleteTask } from '../controllers/taskController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = Router();

// All task routes are protected by authMiddleware
router.use(authMiddleware);

// CRUD operations on tasks
router.post('/', createTask);
router.get('/', getTasks);

// ID-parameterized routes
router.get('/:id', validateObjectId('id'), getTaskById);
router.put('/:id', validateObjectId('id'), updateTask);
router.delete('/:id', validateObjectId('id'), deleteTask);

export default router;
