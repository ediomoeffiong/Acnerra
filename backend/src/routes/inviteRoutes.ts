import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';
import { acceptInvite, cancelInvite, declineInvite, listInvites, sendInvite } from '../controllers/inviteController';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(authMiddleware);

router.get('/', listInvites);
router.post('/', rateLimit('task-invite', 30, 15 * 60 * 1000), sendInvite);
router.post('/:id/accept', validateObjectId('id'), acceptInvite);
router.post('/:id/decline', validateObjectId('id'), declineInvite);
router.delete('/:id', validateObjectId('id'), cancelInvite);

export default router;
