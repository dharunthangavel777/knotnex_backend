import { query } from '../config/database';
import { FcmIntegration } from '../integrations/firebase/fcm.firebase';
import { FirestoreIntegration } from '../integrations/firebase/firestore.firebase';
import { logger } from '../config/logger';
import { buildPaginatedResult } from '../utils/pagination.util';

export class NotificationService {
  static async registerDeviceToken(userId: string, fcmToken: string) {
    await query(
      `UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2`,
      [fcmToken, userId]
    );
    return { success: true };
  }

  /**
   * Creates an in-app database notification and optionally sends push notification
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

  static async sendPush(toUserId: string, title: string, body: string, data?: Record<string, string>) {
    try {
      const res = await query(`SELECT fcm_token FROM users WHERE id = $1`, [toUserId]);
      const fcmToken = res.rows[0]?.fcm_token;

      if (fcmToken) {
        await FcmIntegration.sendPushNotification(fcmToken, title, body, data);
      }
      await FirestoreIntegration.incrementLiveNotificationBadge(toUserId, 'notification').catch(() => {});
    } catch (e: any) {
      // Ignored for environments without FCM configured
    }
    return { sent: true };
  }

  static async sendNotification(toUserId: string, title: string, body: string, data?: Record<string, string>) {
    return this.createNotification(toUserId, null, 'system', title, body, data || {});
  }
}
