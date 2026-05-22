import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationController';

const router = Router();

router.use(authMiddleware);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', validateObjectId('id'), markNotificationRead);

export default router;
