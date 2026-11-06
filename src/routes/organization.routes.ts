import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireOrgOrAdmin, requireOrganizationOwnership } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { createOrgSchema, updateOrgSchema, createReviewSchema } from '../validators/organization.validator';

const router = Router();

router.post('/', authenticate, requireOrgOrAdmin, validate(createOrgSchema), OrganizationController.createOrg);
router.get('/', optionalAuthenticate, OrganizationController.listOrgs);
router.get('/:id', optionalAuthenticate, OrganizationController.getOrgById);
router.patch('/:id', authenticate, requireOrganizationOwnership('id'), validate(updateOrgSchema), OrganizationController.updateOrg);
router.post('/:id/follow', authenticate, OrganizationController.followOrg);
router.delete('/:id/follow', authenticate, OrganizationController.unfollowOrg);
router.post('/:id/reviews', authenticate, validate(createReviewSchema), OrganizationController.addReview);
router.get('/:id/reviews', optionalAuthenticate, OrganizationController.getReviews);
router.get('/:id/dashboard', authenticate, requireOrganizationOwnership('id'), OrganizationController.getDashboard);
router.get('/:id/events', optionalAuthenticate, OrganizationController.getOrgEvents);
router.get('/:id/jobs', optionalAuthenticate, OrganizationController.getOrgJobs);
router.get('/:id/schemes', optionalAuthenticate, OrganizationController.getOrgSchemes);
router.get('/:id/registrations', authenticate, requireOrganizationOwnership('id'), OrganizationController.getOrgRegistrations);
router.get('/:id/job-applications', authenticate, requireOrganizationOwnership('id'), OrganizationController.getOrgJobApplications);
router.get('/:id/scheme-applications', authenticate, requireOrganizationOwnership('id'), OrganizationController.getOrgSchemeApplications);
router.get('/:id/campaigns', optionalAuthenticate, OrganizationController.getOrgCampaigns);
router.post('/:id/campaigns', authenticate, requireOrganizationOwnership('id'), OrganizationController.createOrgCampaign);
router.delete('/:id/campaigns/:campaignId', authenticate, requireOrganizationOwnership('id'), OrganizationController.deleteOrgCampaign);
router.get('/:id/achievements', optionalAuthenticate, OrganizationController.getOrgAchievements);
router.post('/:id/achievements', authenticate, requireOrganizationOwnership('id'), OrganizationController.createOrgAchievement);
router.delete('/:id/achievements/:achId', authenticate, requireOrganizationOwnership('id'), OrganizationController.deleteOrgAchievement);

export default router;
