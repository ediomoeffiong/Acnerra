import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';
import { acceptInvite, declineInvite, listInvites, sendInvite } from '../controllers/inviteController';

const router = Router();

router.use(authMiddleware);

router.get('/', listInvites);
router.post('/', sendInvite);
router.post('/:id/accept', validateObjectId('id'), acceptInvite);
router.post('/:id/decline', validateObjectId('id'), declineInvite);

export default router;
