import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/users', AdminController.listAllUsers);
router.patch('/users/:id/ban', AdminController.setBanStatus);
router.patch('/users/:id/verify', AdminController.setVerificationStatus);
router.get('/feeds/curation', AdminController.getFeedsCuration);
router.patch('/feeds/:postId/action', AdminController.moderateFeedPost);
router.patch('/organizations/:id/verify', AdminController.verifyOrganization);
router.get('/troubleshooting/deep-link', AdminController.getTroubleshootingDeepLink);

export default router;
