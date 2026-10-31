import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { UserService } from '../services/user.service';
import { ApiResponse } from '../utils/response.util';

export class AdminController {
  static async listAllUsers(req: Request, res: Response) {
    try {
      const users = await UserService.listUsers(req.query);
      return ApiResponse.paginated(res, users);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getUserDetails(req: Request, res: Response) {
    try {
      const user = await UserService.getUserById(req.params.id);
      if (!user) return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, user);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async setBanStatus(req: Request, res: Response) {
    try {
      const result = await AdminService.setBanStatus(req.params.id, req.body.isBanned);
      return ApiResponse.success(res, result, 'User ban status updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async setVerificationStatus(req: Request, res: Response) {
    try {
      const result = await AdminService.setVerificationStatus(req.params.id, req.body.isVerified);
      return ApiResponse.success(res, result, 'User verification status updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getFeedsCuration(req: Request, res: Response) {
    try {
      const result = await AdminService.getFeedsCurationQueue(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async moderateFeedPost(req: Request, res: Response) {
    try {
      const result = await AdminService.moderateFeedPost(req.params.postId, req.body.action);
      return ApiResponse.success(res, result, 'Post moderation action applied');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async verifyOrganization(req: Request, res: Response) {
    try {
      const result = await AdminService.verifyOrganization(req.params.id, req.body.isVerified);
      return ApiResponse.success(res, result, 'Organization verification updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async listVerificationRequests(req: Request, res: Response) {
    try {
      const result = await AdminService.listVerificationRequests(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async approveVerificationRequest(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.approveVerificationRequest(req.params.id, adminUserId);
      return ApiResponse.success(res, result, 'Verification request approved and user upgraded to organization');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async rejectVerificationRequest(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.rejectVerificationRequest(req.params.id, adminUserId, req.body.reason);
      return ApiResponse.success(res, result, 'Verification request rejected');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getAdminReels(req: Request, res: Response) {
    try {
      const reels = await AdminService.getAdminReels(req.query);
      return ApiResponse.success(res, reels);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async listAdminCampaigns(req: Request, res: Response) {
    try {
      const campaigns = await AdminService.listAdminCampaigns();
      return ApiResponse.success(res, campaigns);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async deleteAdminCampaign(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteCampaign(req.params.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getTroubleshootingDeepLink(req: Request, res: Response) {
    return ApiResponse.success(res, {
      status: 'operational',
      schemes: ['knotnex://', 'https://knotnex.com/app'],
      routesVerified: [
        'knotnex://events/:id',
        'knotnex://jobs/:id',
        'knotnex://profile/:id',
        'knotnex://chat/:conversationId',
      ],
      timestamp: new Date(),
    });
  }

  // ─── Organization Content Verification (Events, Jobs, Schemes) ──────────────────

  static async listPendingContent(req: Request, res: Response) {
    try {
      const result = await AdminService.listPendingContent();
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async verifyEvent(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.verifyEvent(req.params.id, adminUserId);
      return ApiResponse.success(res, result, 'Event verified and published successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async approveEvent(req: Request, res: Response) {
    return AdminController.verifyEvent(req, res);
  }

  static async rejectEvent(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.rejectEvent(req.params.id, adminUserId, req.body.reason);
      return ApiResponse.success(res, result, 'Event rejected');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async verifyJob(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.verifyJob(req.params.id, adminUserId);
      return ApiResponse.success(res, result, 'Job verified and published successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async rejectJob(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.rejectJob(req.params.id, adminUserId, req.body.reason);
      return ApiResponse.success(res, result, 'Job rejected');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async verifyScheme(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.verifyScheme(req.params.id, adminUserId);
      return ApiResponse.success(res, result, 'Scheme verified and published successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async rejectScheme(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.rejectScheme(req.params.id, adminUserId, req.body.reason);
      return ApiResponse.success(res, result, 'Scheme rejected');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

<<<<<<< HEAD
  static async editFeedPost(req: Request, res: Response) {
    try {
      const result = await AdminService.editFeedPost(req.params.id, req.body);
      return ApiResponse.success(res, result, 'Post updated successfully');
=======
  static async getAuditLogs(req: Request, res: Response) {
    try {
      const logs = await AdminService.getAuditLogs(req.query);
      return ApiResponse.success(res, logs);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async sendUserPasswordReset(req: Request, res: Response) {
    try {
      const adminUserId = (req as any).user?.id || 'admin';
      const result = await AdminService.sendUserPasswordReset(req.params.id, adminUserId);
      return ApiResponse.success(res, result, result.message);
>>>>>>> a62269b67b1b0708a9d7f1ea3af43281ab5f5518
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }
<<<<<<< HEAD

  static async deleteFeedPost(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteFeedPost(req.params.id);
      return ApiResponse.success(res, result, 'Post deleted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getAdminReels(req: Request, res: Response) {
    try {
      const result = await AdminService.getAdminReels(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async editReel(req: Request, res: Response) {
    try {
      const result = await AdminService.editReel(req.params.id, req.body);
      return ApiResponse.success(res, result, 'Reel updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async moderateReel(req: Request, res: Response) {
    try {
      const result = await AdminService.moderateReel(req.params.id, req.body.action, req.body);
      return ApiResponse.success(res, result, 'Reel action applied');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async deleteReel(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteReel(req.params.id);
      return ApiResponse.success(res, result, 'Reel deleted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async deleteTicket(req: Request, res: Response) {
    try {
      const result = await AdminService.deleteTicket(req.params.id);
      return ApiResponse.success(res, result, 'Ticket deleted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async clearTickets(req: Request, res: Response) {
    try {
      const result = await AdminService.clearTickets(req.body);
      return ApiResponse.success(res, result, 'Tickets cleared successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
=======
}
>>>>>>> a62269b67b1b0708a9d7f1ea3af43281ab5f5518
