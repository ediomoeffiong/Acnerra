import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';
import { createCheckIn, listCheckIns } from '../controllers/checkInController';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', validateObjectId('taskId'), listCheckIns);
router.post('/', validateObjectId('taskId'), createCheckIn);

export default router;
