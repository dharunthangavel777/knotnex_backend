import { Request, Response } from 'express';
import { OrganizationService } from '../services/organization.service';
import { AnalyticsService } from '../services/analytics.service';
import { ApiResponse } from '../utils/response.util';

export class OrganizationController {
  static async createOrg(req: Request, res: Response) {
    try {
      const org = await OrganizationService.createOrg(req.user!.id, req.body);
      return ApiResponse.created(res, org);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async listOrgs(req: Request, res: Response) {
    try {
      const result = await OrganizationService.listOrgs(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgById(req: Request, res: Response) {
    try {
      const org = await OrganizationService.getOrgById(req.params.id);
      if (!org) return ApiResponse.error(res, 'Organization not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, org);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateOrg(req: Request, res: Response) {
    try {
      const updated = await OrganizationService.updateOrg(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'Organization updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async followOrg(req: Request, res: Response) {
    try {
      const result = await OrganizationService.followOrg(req.params.id, req.user!.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async unfollowOrg(req: Request, res: Response) {
    try {
      const result = await OrganizationService.unfollowOrg(req.params.id, req.user!.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async addReview(req: Request, res: Response) {
    try {
      const review = await OrganizationService.addReview(
        req.params.id,
        req.user!.id,
        req.body.rating,
        req.body.comment
      );
      return ApiResponse.created(res, review, 'Review submitted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getReviews(req: Request, res: Response) {
    try {
      const reviews = await OrganizationService.getOrgReviews(req.params.id);
      return ApiResponse.success(res, reviews);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getDashboard(req: Request, res: Response) {
    try {
      const stats = await AnalyticsService.getOrgDashboard(req.params.id);
      return ApiResponse.success(res, stats);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
