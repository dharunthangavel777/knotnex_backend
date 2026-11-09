import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../utils/response.util';

export class NotificationController {
  static async listNotifications(req: Request, res: Response) {
    try {
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const result = await NotificationService.listNotifications(req.user!.id, page, limit);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getUnreadCount(req: Request, res: Response) {
    try {
      const count = await NotificationService.getUnreadCount(req.user!.id);
      return ApiResponse.success(res, { unreadCount: count, count });
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const result = await NotificationService.markAsRead(req.params.id, req.user!.id);
      if (!result) return ApiResponse.error(res, 'Notification not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, result, 'Marked as read');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const result = await NotificationService.markAllAsRead(req.user!.id);
      return ApiResponse.success(res, result, 'All notifications marked as read');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async registerDevice(req: Request, res: Response) {
    try {
      const { fcmToken, platform, deviceId, deviceInfo } = req.body;
      const result = await NotificationService.registerDeviceToken(
        req.user!.id,
        fcmToken,
        platform,
        deviceId,
        deviceInfo
      );
      return ApiResponse.success(res, result, 'Device token registered');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async unregisterDevice(req: Request, res: Response) {
    try {
      const fcmToken = req.body.fcmToken || req.params.token;
      if (!fcmToken) {
        return ApiResponse.error(res, 'fcmToken is required', 400);
      }
      const result = await NotificationService.unregisterDeviceToken(req.user!.id, fcmToken);
      return ApiResponse.success(res, result, 'Device token unregistered');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async sendNotification(req: Request, res: Response) {
    try {
      const result = await NotificationService.sendNotification(
        req.body.toUserId,
        req.body.title,
        req.body.body,
        req.body.data
      );
      return ApiResponse.success(res, result, 'Notification sent');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async broadcastWelcome(req: Request, res: Response) {
    try {
      const { title, body, testToken } = req.body || {};
      const result = await NotificationService.broadcastWelcomeNotification(title, body, testToken);
      return ApiResponse.success(res, result, 'Broadcast welcome notifications processed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async testPush(req: Request, res: Response) {
    try {
      const { fcmToken, title, body, data } = req.body || {};
      if (!fcmToken) {
        return ApiResponse.error(res, 'fcmToken is required', 400);
      }
      const { FcmIntegration } = await import('../integrations/firebase/fcm.firebase');
      const response = await FcmIntegration.sendPushNotification(
        fcmToken,
        title || 'KnotNex Test Notification 🔔',
        body || 'Push notification delivery pipeline is 100% operational!',
        data || { type: 'test', timestamp: new Date().toISOString() }
      );
      return ApiResponse.success(res, { success: true, messageId: response }, 'Test push notification sent successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to send test push notification', 500);
    }
  }

  static async getPreferences(req: Request, res: Response) {
    try {
      const result = await NotificationService.getPreferences(req.user!.id);
      return ApiResponse.success(res, result, 'Notification preferences retrieved');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updatePreferences(req: Request, res: Response) {
    try {
      const result = await NotificationService.updatePreferences(req.user!.id, req.body);
      return ApiResponse.success(res, result, 'Notification preferences updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }
}
