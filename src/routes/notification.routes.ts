import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.get('/', authenticate, NotificationController.listNotifications);
router.get('/preferences', authenticate, NotificationController.getPreferences);
router.put('/preferences', authenticate, NotificationController.updatePreferences);
router.get('/unread-count', authenticate, NotificationController.getUnreadCount);
router.patch('/read-all', authenticate, NotificationController.markAllAsRead);
router.patch('/:id/read', authenticate, NotificationController.markAsRead);
router.post('/register-device', authenticate, NotificationController.registerDevice);
router.post('/unregister-device', authenticate, NotificationController.unregisterDevice);
router.delete('/devices/:token', authenticate, NotificationController.unregisterDevice);
router.post('/send', authenticate, requireAdmin, NotificationController.sendNotification);
router.post('/broadcast-welcome', NotificationController.broadcastWelcome);
router.post('/test-push', NotificationController.testPush);

// Admin Broadcast Management Routes
router.get('/broadcasts/estimate', authenticate, requireAdmin, NotificationController.estimateBroadcastAudience);
router.get('/broadcasts', authenticate, requireAdmin, NotificationController.listBroadcasts);
router.post('/broadcasts', authenticate, requireAdmin, NotificationController.createBroadcast);
router.get('/broadcasts/:id', authenticate, requireAdmin, NotificationController.getBroadcastDetails);
router.post('/broadcasts/:id/send', authenticate, requireAdmin, NotificationController.sendBroadcast);
router.post('/broadcasts/:id/cancel', authenticate, requireAdmin, NotificationController.cancelBroadcast);
router.post('/broadcasts/:id/retry', authenticate, requireAdmin, NotificationController.retryFailedRecipients);

export default router;
