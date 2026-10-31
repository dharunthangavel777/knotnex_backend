import { Request, Response } from 'express';
import { CampaignService } from '../services/campaign.service';
import { ApiResponse } from '../utils/response.util';

export class CampaignController {
  static async listCampaigns(req: Request, res: Response) {
    try {
      const { category, search } = req.query;
      const campaigns = await CampaignService.listCampaigns({
        category: category ? String(category) : undefined,
        search: search ? String(search) : undefined,
      });
      return ApiResponse.success(res, campaigns);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getCampaignById(req: Request, res: Response) {
    try {
      const campaign = await CampaignService.getCampaignById(req.params.id);
      if (!campaign) {
        return ApiResponse.error(res, 'Campaign not found', 404);
      }
      return ApiResponse.success(res, campaign);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async donate(req: Request, res: Response) {
    try {
      const { amount, donorName, donorEmail, message } = req.body;
      const result = await CampaignService.recordDonation(req.params.id, amount, {
        name: donorName || (req.user as any)?.name,
        email: donorEmail || (req.user as any)?.email,
        message,
      });
      return ApiResponse.success(res, result, result.message);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }
}

