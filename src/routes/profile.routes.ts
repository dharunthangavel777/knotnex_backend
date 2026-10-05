import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validator.middleware';
import { updateProfileSchema } from '../validators/profile.validator';

const router = Router();

router.get('/:userId', authenticate, ProfileController.getProfile);
router.patch('/:userId', authenticate, validate(updateProfileSchema), ProfileController.updateProfile);
router.get('/:userId/qr', authenticate, ProfileController.getQr);
router.get('/:userId/dashboard', authenticate, ProfileController.getDashboard);

export default router;
