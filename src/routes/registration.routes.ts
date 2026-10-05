import { Router } from 'express';
import { RegistrationController } from '../controllers/registration.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgOrAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { registerEventSchema, updateRegistrationStatusSchema } from '../validators/registration.validator';

const router = Router();

router.post('/', authenticate, validate(registerEventSchema), RegistrationController.register);
router.get('/my-registrations', authenticate, RegistrationController.listByUser);
router.get('/event/:eventId', authenticate, requireOrgOrAdmin, RegistrationController.listByEvent);
router.get('/user/:userId', authenticate, RegistrationController.listByUser);
router.get('/:id', authenticate, RegistrationController.getById);
router.patch('/:id/status', authenticate, requireOrgOrAdmin, validate(updateRegistrationStatusSchema), RegistrationController.updateStatus);
router.post('/check-in', authenticate, requireOrgOrAdmin, RegistrationController.checkInByQr);
router.get('/:id/qr-pass', authenticate, RegistrationController.getQrPass);

export default router;
