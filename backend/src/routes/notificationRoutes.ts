import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateObjectId } from '../middleware/validateObjectId';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../controllers/notificationController';

const router = Router();

router.use(authMiddleware);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.get('/preferences', getNotificationPreferences);
router.put('/preferences', updateNotificationPreferences);
router.patch('/:id/read', validateObjectId('id'), markNotificationRead);
router.delete('/:id', validateObjectId('id'), deleteNotification);

export default router;
