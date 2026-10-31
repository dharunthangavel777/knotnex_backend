import { Router } from 'express';
import { CampaignController } from '../controllers/campaign.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuthenticate, CampaignController.listCampaigns);
router.get('/:id', optionalAuthenticate, CampaignController.getCampaignById);
router.post('/:id/donate', optionalAuthenticate, CampaignController.donate);

export default router;

