import { query } from '../config/database';
import { FcmIntegration } from '../integrations/firebase/fcm.firebase';
import { FirestoreIntegration } from '../integrations/firebase/firestore.firebase';
import { logger } from '../config/logger';
import { buildPaginatedResult } from '../utils/pagination.util';

export class NotificationService {
  /**
   * Registers a client device FCM token for multi-device push notifications.
   */
  static async registerDeviceToken(
    userId: string,
    fcmToken: string,
    platform: string = 'android',
    deviceId?: string,
    deviceInfo: any = {}
  ) {
    if (!fcmToken) return { success: false, message: 'No token provided' };

    try {
      await query(
        `INSERT INTO user_devices (user_id, fcm_token, platform, device_id, device_info, is_active, last_active_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
         ON CONFLICT (user_id, fcm_token) 
         DO UPDATE SET 
           is_active = TRUE, 
           platform = COALESCE($3, user_devices.platform),
           device_id = COALESCE($4, user_devices.device_id),
           device_info = COALESCE($5, user_devices.device_info),
           last_active_at = NOW(),
           updated_at = NOW()`,
        [userId, fcmToken, platform, deviceId || null, JSON.stringify(deviceInfo)]
      );
    } catch (e: any) {
      logger.warn('[NotificationService.registerDeviceToken] user_devices insert notice: ' + e.message);
    }

    // Also update users.fcm_token for backward compatibility
    await query(
      `UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2`,
      [fcmToken, userId]
    ).catch(() => {});

    return { success: true };
  }

  /**
   * Unregisters/deactivates a device token upon logout.
   */
  static async unregisterDeviceToken(userId: string, fcmToken: string) {
    try {
      await query(
        `UPDATE user_devices SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1 AND fcm_token = $2`,
        [userId, fcmToken]
      );
      await query(
        `UPDATE users SET fcm_token = NULL WHERE id = $1 AND fcm_token = $2`,
        [userId, fcmToken]
      ).catch(() => {});
    } catch (e: any) {
      logger.warn('[NotificationService.unregisterDeviceToken] Error: ' + e.message);
    }
    return { success: true };
  }

  /**
   * Creates an in-app database notification and dispatches push notification across active devices.
   */
  static async createNotification(
    userId: string,
    actorId: string | null,
    type: string,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ) {
    try {
      const res = await query(
        `INSERT INTO notifications (user_id, actor_id, type, title, body, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, actorId, type, title, body, JSON.stringify(data)]
      );

      // Attempt push notification asynchronously (non-blocking)
      this.sendPush(userId, title, body, data).catch(() => {});

      return res.rows[0];
    } catch (err: any) {
      logger.warn('[NotificationService] Failed to create notification', { error: err.message });
      return null;
    }
  }

  static async listNotifications(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const [countRes, itemsRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`, [userId]),
      query(
        `SELECT n.*, u.full_name as actor_name, u.avatar_url as actor_avatar
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
         WHERE n.user_id = $1
         ORDER BY n.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    return buildPaginatedResult(itemsRes.rows, total, page, limit);
  }

  static async markAsRead(notificationId: string, userId: string) {
    const res = await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [notificationId, userId]
    );
    return res.rows[0] || null;
  }

  static async markAllAsRead(userId: string) {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return { success: true };
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const res = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  /**
   * Dispatches push notification to all active devices registered to the target user.
   */
  static async sendPush(toUserId: string, title: string, body: string, data?: Record<string, any>) {
    try {
      // 1. Fetch active devices from user_devices
      let tokens: string[] = [];
      try {
        const devRes = await query(
          `SELECT fcm_token FROM user_devices WHERE user_id = $1 AND is_active = TRUE`,
          [toUserId]
        );
        if (devRes.rowCount && devRes.rowCount > 0) {
          tokens = devRes.rows.map((r) => r.fcm_token).filter(Boolean);
        }
      } catch (err: any) {
        // Table fallback
      }

      // Fallback to users table if no active devices found
      if (tokens.length === 0) {
        const userRes = await query(`SELECT fcm_token FROM users WHERE id = $1`, [toUserId]);
        if (userRes.rows[0]?.fcm_token) {
          tokens.push(userRes.rows[0].fcm_token);
        }
      }

      if (tokens.length === 0) return { sent: false, reason: 'No active device tokens' };

      const stringData: Record<string, string> = {};
      if (data) {
        for (const [k, v] of Object.entries(data)) {
          stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      }

      if (tokens.length === 1) {
        try {
          await FcmIntegration.sendPushNotification(tokens[0], title, body, stringData);
        } catch (err: any) {
          if (
            err.message?.includes('registration-token-not-registered') ||
            err.code === 'messaging/registration-token-not-registered'
          ) {
            await query(`UPDATE user_devices SET is_active = FALSE WHERE fcm_token = $1`, [tokens[0]]).catch(() => {});
          }
        }
      } else {
        try {
          await FcmIntegration.sendMulticast(tokens, title, body, stringData);
        } catch (err: any) {
          logger.warn('[NotificationService.sendPush] Multicast notice: ' + err.message);
        }
      }

      await FirestoreIntegration.incrementLiveNotificationBadge(toUserId, 'notification').catch(() => {});
      return { sent: true, recipientCount: tokens.length };
    } catch (e: any) {
      logger.warn('[NotificationService.sendPush] Error: ' + e.message);
      return { sent: false, error: e.message };
    }
  }

  static async sendNotification(toUserId: string, title: string, body: string, data?: Record<string, any>) {
    return this.createNotification(toUserId, null, 'system', title, body, data || {});
  }
}
