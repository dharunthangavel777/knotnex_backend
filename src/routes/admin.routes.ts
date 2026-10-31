import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/users', AdminController.listAllUsers);
router.get('/users/:id', AdminController.getUserDetails);
router.patch('/users/:id/ban', AdminController.setBanStatus);
router.patch('/users/:id/verify', AdminController.setVerificationStatus);
router.post('/users/:id/send-reset-password', AdminController.sendUserPasswordReset);
router.get('/feeds/curation', AdminController.getFeedsCuration);
router.patch('/feeds/:postId/action', AdminController.moderateFeedPost);
router.patch('/organizations/:id/verify', AdminController.verifyOrganization);
router.get('/reels', AdminController.getAdminReels);
router.get('/campaigns', AdminController.listAdminCampaigns);
router.delete('/campaigns/:id', AdminController.deleteAdminCampaign);

// Organization Verification Management
router.get('/verifications', AdminController.listVerificationRequests);
router.post('/verifications/:id/approve', AdminController.approveVerificationRequest);
router.post('/verifications/:id/reject', AdminController.rejectVerificationRequest);

// Organization Content Verification (Events, Jobs, Schemes)
router.get('/pending-content', AdminController.listPendingContent);
router.get('/verifications/pending-items', AdminController.listPendingContent);

router.post('/events/:id/verify', AdminController.verifyEvent);
router.post('/events/:id/approve', AdminController.verifyEvent);
router.post('/events/:id/reject', AdminController.rejectEvent);

router.post('/jobs/:id/verify', AdminController.verifyJob);
router.post('/jobs/:id/approve', AdminController.verifyJob);
router.post('/jobs/:id/reject', AdminController.rejectJob);

router.post('/schemes/:id/verify', AdminController.verifyScheme);
router.post('/schemes/:id/approve', AdminController.verifyScheme);
router.post('/schemes/:id/reject', AdminController.rejectScheme);

router.get('/troubleshooting/deep-link', AdminController.getTroubleshootingDeepLink);

router.get('/audit-logs', AdminController.getAuditLogs);

export default router;
