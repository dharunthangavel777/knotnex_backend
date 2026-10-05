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
}
