import { Router } from 'express';
import { JobController } from '../controllers/job.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireOrgOrAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { createJobSchema, updateJobSchema } from '../validators/job.validator';

const router = Router();

router.post('/', authenticate, requireOrgOrAdmin, validate(createJobSchema), JobController.createJob);
router.get('/', optionalAuthenticate, JobController.listJobs);
router.get('/:id', optionalAuthenticate, JobController.getJobById);
router.patch('/:id', authenticate, requireOrgOrAdmin, validate(updateJobSchema), JobController.updateJob);
router.delete('/:id', authenticate, requireOrgOrAdmin, JobController.deleteJob);
router.post('/:id/save', authenticate, JobController.saveJob);
router.get('/:id/similar', optionalAuthenticate, JobController.getSimilarJobs);

export default router;
