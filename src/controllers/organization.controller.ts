import { Request, Response } from 'express';
import { OrganizationService } from '../services/organization.service';
import { AnalyticsService } from '../services/analytics.service';
import { ApiResponse } from '../utils/response.util';
import { query } from '../config/database';

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
      const currentUserId = req.user?.id;
      const result = await OrganizationService.listOrgs(req.query, currentUserId);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgById(req: Request, res: Response) {
    try {
      const currentUserId = req.user?.id;
      const org = await OrganizationService.getOrgById(req.params.id, currentUserId);
      if (!org) return ApiResponse.error(res, 'Organization not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, org);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateOrg(req: Request, res: Response) {
    try {
      const orgId = req.params.id;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Ownership authorization check
      if (userRole !== 'admin') {
        const check = await query(`SELECT owner_id FROM organizations WHERE id = $1`, [orgId]);
        if (check.rows.length === 0) {
          return ApiResponse.error(res, 'Organization not found', 404, 'NOT_FOUND');
        }
        const ownerId = check.rows[0]?.owner_id;
        const isOwner = Boolean(ownerId && userId && ownerId === userId);
        if (!isOwner) {
          const member = await query(
            `SELECT role_in_org FROM org_team_members WHERE org_id = $1 AND user_id = $2`,
            [orgId, userId]
          );
          if (member.rows.length === 0) {
            return ApiResponse.error(res, 'You do not have permission to edit this organization', 403, 'FORBIDDEN');
          }
        }
      }

      // Protect admin-only fields
      const safeData = { ...req.body };
      if (userRole !== 'admin') {
        delete safeData.is_verified;
        delete safeData.isVerified;
        delete safeData.followers_count;
        delete safeData.followersCount;
      }

      const updated = await OrganizationService.updateOrg(orgId, safeData);
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

  static async getOrgEvents(req: Request, res: Response) {
    try {
      const result = await OrganizationService.getOrgEvents(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgJobs(req: Request, res: Response) {
    try {
      const result = await OrganizationService.getOrgJobs(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgSchemes(req: Request, res: Response) {
    try {
      const result = await OrganizationService.getOrgSchemes(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgRegistrations(req: Request, res: Response) {
    try {
      const result = await OrganizationService.getOrgRegistrations(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgCampaigns(req: Request, res: Response) {
    try {
      const campaigns = await OrganizationService.getOrgCampaigns(req.params.id);
      return ApiResponse.success(res, campaigns);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async createOrgCampaign(req: Request, res: Response) {
    try {
      const campaign = await OrganizationService.createOrgCampaign(req.params.id, req.body);
      return ApiResponse.created(res, campaign, 'Campaign created');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async deleteOrgCampaign(req: Request, res: Response) {
    try {
      const result = await OrganizationService.deleteOrgCampaign(req.params.id, req.params.campaignId);
      return ApiResponse.success(res, result, 'Campaign deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgAchievements(req: Request, res: Response) {
    try {
      const achievements = await OrganizationService.getOrgAchievements(req.params.id);
      return ApiResponse.success(res, achievements);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async createOrgAchievement(req: Request, res: Response) {
    try {
      const achievement = await OrganizationService.createOrgAchievement(req.params.id, req.body);
      return ApiResponse.created(res, achievement, 'Achievement recorded');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async deleteOrgAchievement(req: Request, res: Response) {
    try {
      const result = await OrganizationService.deleteOrgAchievement(req.params.id, req.params.achId);
      return ApiResponse.success(res, result, 'Achievement deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgJobApplications(req: Request, res: Response) {
    try {
      const result = await OrganizationService.getOrgJobApplications(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getOrgSchemeApplications(req: Request, res: Response) {
    try {
      const result = await OrganizationService.getOrgSchemeApplications(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
