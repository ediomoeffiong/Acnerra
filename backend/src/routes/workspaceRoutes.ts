import { Router } from 'express';
import { getWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace, restoreDefaultWorkspaces } from '../controllers/workspaceController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authMiddleware, getWorkspaces);
router.post('/', authMiddleware, createWorkspace);
router.post('/restore', authMiddleware, restoreDefaultWorkspaces);
router.put('/:id', authMiddleware, updateWorkspace);
router.delete('/:id', authMiddleware, deleteWorkspace);

export default router;
