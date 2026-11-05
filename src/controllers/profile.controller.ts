import { Request, Response } from 'express';
import { ProfileService } from '../services/profile.service';
import { ApiResponse } from '../utils/response.util';

export class ProfileController {
  static async getProfile(req: Request, res: Response) {
    try {
      const profile = await ProfileService.getProfileByUserId(req.params.userId);
      if (!profile) return ApiResponse.error(res, 'Profile not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, profile);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const targetUserId = req.params.userId;
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;

      if (targetUserId !== currentUserId && currentUserRole !== 'admin') {
        return ApiResponse.error(res, 'You do not have permission to update this profile', 403, 'FORBIDDEN');
      }

      const updated = await ProfileService.updateProfile(targetUserId, req.body);
      return ApiResponse.success(res, updated, 'Profile updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getQr(req: Request, res: Response) {
    try {
      const result = await ProfileService.generateProfileQr(req.params.userId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getDashboard(req: Request, res: Response) {
    try {
      const stats = await ProfileService.getDashboardStats(req.params.userId);
      return ApiResponse.success(res, stats);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
