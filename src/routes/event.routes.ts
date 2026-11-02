import { RegistrationController } from '../controllers/registration.controller';
import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireOrgOrAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { createEventSchema, updateEventSchema } from '../validators/event.validator';

const router = Router();

router.post('/', authenticate, requireOrgOrAdmin, validate(createEventSchema), EventController.createEvent);
router.get('/', optionalAuthenticate, EventController.listEvents);
router.get('/:id', optionalAuthenticate, EventController.getEventById);
router.patch('/:id', authenticate, requireOrgOrAdmin, validate(updateEventSchema), EventController.updateEvent);
router.delete('/:id', authenticate, requireOrgOrAdmin, EventController.deleteEvent);
router.post('/:id/register', authenticate, RegistrationController.register);
router.get('/:id/attendance', authenticate, requireOrgOrAdmin, RegistrationController.getEventAttendance);
router.post('/:id/scan', authenticate, requireOrgOrAdmin, RegistrationController.checkInByQr);
router.post('/:id/save', authenticate, EventController.saveEvent);
router.delete('/:id/save', authenticate, EventController.unsaveEvent);
router.get('/:id/similar', optionalAuthenticate, EventController.getSimilarEvents);

export default router;
