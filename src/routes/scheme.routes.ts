import { Router } from 'express';
import { SchemeController } from '../controllers/scheme.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireOrgOrAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { createSchemeSchema, updateSchemeSchema, applySchemeSchema, updateSchemeApplicationStatusSchema } from '../validators/scheme.validator';

const router = Router();

router.post('/', authenticate, requireOrgOrAdmin, validate(createSchemeSchema), SchemeController.createScheme);
router.get('/', optionalAuthenticate, SchemeController.listSchemes);
router.get('/applications/:appId', authenticate, requireOrgOrAdmin, SchemeController.getApplicationById);
router.patch('/applications/:appId/status', authenticate, requireOrgOrAdmin, validate(updateSchemeApplicationStatusSchema), SchemeController.updateApplicationStatus);
router.get('/org/:orgId/applications', authenticate, requireOrgOrAdmin, SchemeController.getOrgSchemeApplications);
router.get('/:id', optionalAuthenticate, SchemeController.getSchemeById);
router.patch('/:id', authenticate, requireOrgOrAdmin, validate(updateSchemeSchema), SchemeController.updateScheme);
router.delete('/:id', authenticate, requireOrgOrAdmin, SchemeController.deleteScheme);
router.post('/:id/apply', authenticate, validate(applySchemeSchema), SchemeController.applyForScheme);
router.get('/:id/applications', authenticate, requireOrgOrAdmin, SchemeController.listApplications);
router.patch('/:id/applications/:appId/status', authenticate, requireOrgOrAdmin, validate(updateSchemeApplicationStatusSchema), SchemeController.updateApplicationStatus);

export default router;
