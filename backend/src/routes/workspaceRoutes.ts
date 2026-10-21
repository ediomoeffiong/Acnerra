import { Router } from 'express';
import { getWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace, restoreDefaultWorkspaces, removePartnerFromWorkspace, updateWorkspaceMembers } from '../controllers/workspaceController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';

const router = Router();

router.get('/', authMiddleware, getWorkspaces);
router.post('/', authMiddleware, createWorkspace);
router.post('/restore', authMiddleware, restoreDefaultWorkspaces);
router.put('/:id', authMiddleware, validateObjectId('id'), updateWorkspace);
router.put('/:id/members', authMiddleware, validateObjectId('id'), updateWorkspaceMembers);
router.delete('/:id', authMiddleware, validateObjectId('id'), deleteWorkspace);
router.delete('/:id/partners/:partnerId', authMiddleware, validateObjectId('id'), validateObjectId('partnerId'), removePartnerFromWorkspace);

export default router;
