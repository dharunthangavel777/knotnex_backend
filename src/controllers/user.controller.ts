import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { ApiResponse } from '../utils/response.util';

export class UserController {
  static async listUsers(req: Request, res: Response) {
    try {
      const result = await UserService.listUsers(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getUserById(req: Request, res: Response) {
    try {
      const currentUserId = req.user?.id;
      const user = await UserService.getUserById(req.params.id, currentUserId);
      if (!user) return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, user);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const user = await UserService.getUserById(userId, userId);
      if (!user) return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, user);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const updated = await UserService.updateUser(userId, req.body);
      return ApiResponse.success(res, updated, 'Profile updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const updated = await UserService.updateUser(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'User updated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async followUser(req: Request, res: Response) {
    try {
      const result = await UserService.followUser(req.user!.id, req.params.id);
      return ApiResponse.success(res, result, 'Followed user successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async unfollowUser(req: Request, res: Response) {
    try {
      const result = await UserService.unfollowUser(req.user!.id, req.params.id);
      return ApiResponse.success(res, result, 'Unfollowed user successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getFollowers(req: Request, res: Response) {
    try {
      const result = await UserService.getFollowers(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getFollowing(req: Request, res: Response) {
    try {
      const result = await UserService.getFollowing(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async listUserDevices(req: Request, res: Response) {
    try {
      const devices = await UserService.listUserDevices(req.params.id);
      return ApiResponse.success(res, devices);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async removeUserDevice(req: Request, res: Response) {
    try {
      const result = await UserService.removeUserDevice(req.params.id, req.params.deviceId);
      return ApiResponse.success(res, result, 'Device session removed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
