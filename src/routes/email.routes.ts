import { Router } from 'express';
import { EmailController } from '../integrations/email/email.controller';

const router = Router();

// List all registered templates
router.get('/templates', EmailController.listTemplates);

// Preview rendered HTML or JSON
router.get('/preview/:templateKey', EmailController.previewTemplate);

// Test dispatch endpoint
router.post('/test-send', EmailController.testSend);

export default router;

