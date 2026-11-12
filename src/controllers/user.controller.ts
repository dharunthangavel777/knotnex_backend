import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { PresenceService } from '../services/presence.service';
import { getSocketIO } from '../websockets/socket.server';
import { ApiResponse } from '../utils/response.util';

export class UserController {
  static async checkUsernameAvailability(req: Request, res: Response) {
    try {
      const username = (req.query.username as string) || '';
      const excludeUserId = (req.query.excludeUserId as string) || req.user?.id;
      const result = await UserService.checkUsernameAvailability(username, excludeUserId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

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
      const currentUserRole = req.user?.role;
      const user = await UserService.getUserById(req.params.id, currentUserId, currentUserRole);
      if (!user) return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, user);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const user = await UserService.getUserById(userId, userId, userRole);
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
      const targetUserId = req.params.id;
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;

      if (targetUserId !== currentUserId && currentUserRole !== 'admin') {
        return ApiResponse.error(res, 'You do not have permission to update this profile', 403, 'FORBIDDEN');
      }

      const updated = await UserService.updateUser(targetUserId, req.body);
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
      const targetUserId = req.params.id;
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;

      if (targetUserId !== currentUserId && currentUserRole !== 'admin') {
        return ApiResponse.error(res, 'You do not have permission to manage this device session', 403, 'FORBIDDEN');
      }

      const result = await UserService.removeUserDevice(req.params.id, req.params.deviceId);
      return ApiResponse.success(res, result, 'Device session removed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getMyOrganization(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const org = await UserService.getMyOrganization(userId);
      return ApiResponse.success(res, org, org ? 'Organization fetched' : 'No organization associated with this account');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getPrivacySettings(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const settings = await PresenceService.getPrivacySettings(userId);
      return ApiResponse.success(res, settings, 'Privacy settings fetched');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updatePrivacySettings(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const settings = await PresenceService.updatePrivacySettings(userId, {
        showOnlineStatus: req.body.showOnlineStatus,
        showLastSeen: req.body.showLastSeen,
        readReceiptsEnabled: req.body.readReceiptsEnabled,
        allowMessageRequests: req.body.allowMessageRequests,
      });

      const io = getSocketIO();
      if (io) {
        io.emit('presence_change', {
          userId,
          isOnline: settings.showOnlineStatus && PresenceService.isUserLocallyConnected(userId),
          lastSeenAt: settings.showLastSeen ? new Date().toISOString() : null,
          hidden: !settings.showOnlineStatus && !settings.showLastSeen,
        });
      }

      return ApiResponse.success(res, settings, 'Privacy settings updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
