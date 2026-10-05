import { Router } from 'express';
import { ApplicationController } from '../controllers/application.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgOrAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { submitApplicationSchema, updateApplicationStageSchema } from '../validators/application.validator';

const router = Router();

router.post('/', authenticate, validate(submitApplicationSchema), ApplicationController.submit);
router.get('/my-applications', authenticate, ApplicationController.listByUser);
router.get('/job/:jobId', authenticate, requireOrgOrAdmin, ApplicationController.listByJob);
router.get('/user/:userId', authenticate, ApplicationController.listByUser);
router.get('/:id', authenticate, ApplicationController.getById);
router.patch('/:id/stage', authenticate, requireOrgOrAdmin, validate(updateApplicationStageSchema), ApplicationController.updateStage);

export default router;
