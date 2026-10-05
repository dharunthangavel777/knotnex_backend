import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireOrgOrAdmin } from '../middleware/role.middleware';

const router = Router();

router.get('/dashboard', authenticate, requireAdmin, AnalyticsController.getPlatformDashboard);
router.get('/org/:orgId', authenticate, requireOrgOrAdmin, AnalyticsController.getOrgDashboard);
router.get('/ai-scan', authenticate, requireAdmin, AnalyticsController.getAiScan);

export default router;
