import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { ApiResponse } from '../utils/response.util';

export class AnalyticsController {
  static async getPlatformDashboard(req: Request, res: Response) {
    try {
      const stats = await AnalyticsService.getPlatformDashboard();
      return ApiResponse.success(res, stats);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgDashboard(req: Request, res: Response) {
    try {
      const stats = await AnalyticsService.getOrgDashboard(req.params.orgId);
      return ApiResponse.success(res, stats);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getAiScan(req: Request, res: Response) {
    try {
      const insights = await AnalyticsService.getAiScanInsights();
      return ApiResponse.success(res, insights);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
