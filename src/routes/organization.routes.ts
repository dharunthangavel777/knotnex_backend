import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireOrgOrAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { createOrgSchema, updateOrgSchema, createReviewSchema } from '../validators/organization.validator';

const router = Router();

router.post('/', authenticate, requireOrgOrAdmin, validate(createOrgSchema), OrganizationController.createOrg);
router.get('/', optionalAuthenticate, OrganizationController.listOrgs);
router.get('/:id', optionalAuthenticate, OrganizationController.getOrgById);
router.patch('/:id', authenticate, requireOrgOrAdmin, validate(updateOrgSchema), OrganizationController.updateOrg);
router.post('/:id/follow', authenticate, OrganizationController.followOrg);
router.delete('/:id/follow', authenticate, OrganizationController.unfollowOrg);
router.post('/:id/reviews', authenticate, validate(createReviewSchema), OrganizationController.addReview);
router.get('/:id/reviews', optionalAuthenticate, OrganizationController.getReviews);
router.get('/:id/dashboard', authenticate, OrganizationController.getDashboard);
router.get('/:id/events', optionalAuthenticate, OrganizationController.getOrgEvents);
router.get('/:id/jobs', optionalAuthenticate, OrganizationController.getOrgJobs);
router.get('/:id/schemes', optionalAuthenticate, OrganizationController.getOrgSchemes);
router.get('/:id/registrations', authenticate, OrganizationController.getOrgRegistrations);
router.get('/:id/job-applications', authenticate, requireOrgOrAdmin, OrganizationController.getOrgJobApplications);
router.get('/:id/scheme-applications', authenticate, requireOrgOrAdmin, OrganizationController.getOrgSchemeApplications);
router.get('/:id/campaigns', optionalAuthenticate, OrganizationController.getOrgCampaigns);
router.post('/:id/campaigns', authenticate, requireOrgOrAdmin, OrganizationController.createOrgCampaign);
router.delete('/:id/campaigns/:campaignId', authenticate, requireOrgOrAdmin, OrganizationController.deleteOrgCampaign);
router.get('/:id/achievements', optionalAuthenticate, OrganizationController.getOrgAchievements);
router.post('/:id/achievements', authenticate, requireOrgOrAdmin, OrganizationController.createOrgAchievement);
router.delete('/:id/achievements/:achId', authenticate, requireOrgOrAdmin, OrganizationController.deleteOrgAchievement);

export default router;
