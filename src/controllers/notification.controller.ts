import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { ApiResponse } from '../utils/response.util';

export class NotificationController {
  static async listNotifications(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const result = await NotificationService.listNotifications(req.user!.id, page, limit);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getUnreadCount(req: Request, res: Response) {
    try {
      const count = await NotificationService.getUnreadCount(req.user!.id);
      return ApiResponse.success(res, { unreadCount: count });
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
      const result = await NotificationService.registerDeviceToken(req.user!.id, req.body.fcmToken);
      return ApiResponse.success(res, result, 'Device token registered');
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
}
