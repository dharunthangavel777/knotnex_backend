import { Router } from 'express';
import { VerificationController } from '../controllers/verification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/apply', VerificationController.apply);
router.get('/my-status', VerificationController.myStatus);
router.post('/complete-category', VerificationController.completeCategory);

export default router;
