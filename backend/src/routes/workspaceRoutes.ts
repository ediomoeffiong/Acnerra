import { Router } from 'express';
import { getWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace, restoreDefaultWorkspaces, removePartnerFromWorkspace } from '../controllers/workspaceController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authMiddleware, getWorkspaces);
router.post('/', authMiddleware, createWorkspace);
router.post('/restore', authMiddleware, restoreDefaultWorkspaces);
router.put('/:id', authMiddleware, updateWorkspace);
router.delete('/:id', authMiddleware, deleteWorkspace);
router.delete('/:id/partners/:partnerId', authMiddleware, removePartnerFromWorkspace);

export default router;
