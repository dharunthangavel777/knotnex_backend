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
      // Check user preferences before dispatching push notification
      const prefs = await this.getPreferences(toUserId);
      if (prefs.pause_all) {
        return { sent: false, reason: 'User paused all push notifications' };
      }

      const notifType = data?.type || '';
      if ((notifType === 'chat' || notifType === 'message') && prefs.messages === false) {
        return { sent: false, reason: 'User disabled message notifications' };
      }
      if ((notifType === 'like' || notifType === 'reaction') && prefs.reactions === false) {
        return { sent: false, reason: 'User disabled reaction notifications' };
      }
      if ((notifType === 'comment' || notifType === 'mention') && prefs.comments === false) {
        return { sent: false, reason: 'User disabled comment notifications' };
      }
      if (notifType === 'event' && prefs.events === false) {
        return { sent: false, reason: 'User disabled event notifications' };
      }
      if ((notifType === 'career' || notifType === 'job') && prefs.careers === false) {
        return { sent: false, reason: 'User disabled career notifications' };
      }
      if (notifType === 'scheme' && prefs.schemes === false) {
        return { sent: false, reason: 'User disabled scheme notifications' };
      }

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

  /**
   * Broadcasts a welcome push notification to all users who have active FCM device tokens.
   */
  static async broadcastWelcomeNotification(customTitle?: string, customBody?: string, testToken?: string) {
    const title = customTitle || 'Welcome to KnotNex! 🚀';
    const body = customBody || 'Welcome to KnotNex! Connect with professionals, explore career opportunities, and collaborate in real-time.';
    const data: Record<string, string> = {
      type: 'welcome',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      route: '/home',
      sentAt: new Date().toISOString(),
    };

    let targetTokens: { token: string; userId?: string; name?: string }[] = [];

    if (testToken) {
      targetTokens.push({ token: testToken, name: 'Direct Test Device' });
    }

    try {
      // 1. Fetch from user_devices
      const devRes = await query(
        `SELECT ud.fcm_token, ud.user_id, u.full_name, u.email
         FROM user_devices ud
         JOIN users u ON u.id = ud.user_id
         WHERE ud.is_active = TRUE AND ud.fcm_token IS NOT NULL`
      );
      for (const row of devRes.rows) {
        if (!targetTokens.some(t => t.token === row.fcm_token)) {
          targetTokens.push({ token: row.fcm_token, userId: row.user_id, name: row.full_name || row.email });
        }
      }
    } catch (e: any) {
      logger.warn('[broadcastWelcomeNotification] user_devices query notice: ' + e.message);
    }

    try {
      // 2. Fetch from users table
      const userRes = await query(
        `SELECT id, full_name, email, fcm_token FROM users WHERE fcm_token IS NOT NULL`
      );
      for (const row of userRes.rows) {
        if (!targetTokens.some(t => t.token === row.fcm_token)) {
          targetTokens.push({ token: row.fcm_token, userId: row.id, name: row.full_name || row.email });
        }
      }
    } catch (e: any) {
      logger.warn('[broadcastWelcomeNotification] users query notice: ' + e.message);
    }

    if (targetTokens.length === 0) {
      return {
        sent: false,
        message: 'No registered device tokens found in database. Make sure users have logged in and registered tokens via /notifications/register-device.',
        targetCount: 0,
        results: [],
      };
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const target of targetTokens) {
      try {
        const res = await FcmIntegration.sendPushNotification(target.token, title, body, data);
        successCount++;
        results.push({
          user: target.name || target.userId,
          token: target.token.substring(0, 25) + '...',
          status: 'SUCCESS',
          messageId: res,
        });
      } catch (err: any) {
        failureCount++;
        results.push({
          user: target.name || target.userId,
          token: target.token.substring(0, 25) + '...',
          status: 'FAILED',
          error: err.code || err.message,
        });
      }
    }

    return {
      sent: true,
      totalDevices: targetTokens.length,
      successCount,
      failureCount,
      results,
    };
  }

  static async getPreferences(userId: string) {
    try {
      const res = await query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (_) {}

    return {
      user_id: userId,
      messages: true,
      reactions: true,
      comments: true,
      followers: true,
      events: true,
      careers: true,
      schemes: true,
      system_alerts: true,
      pause_all: false,
      sound_vibrate: true,
    };
  }

  static async updatePreferences(userId: string, prefs: any) {
    const existing = await this.getPreferences(userId);
    const updated = {
      messages: prefs.messages !== undefined ? prefs.messages : (prefs.direct_messages !== undefined ? prefs.direct_messages : existing.messages),
      reactions: prefs.reactions !== undefined ? prefs.reactions : (prefs.likes_reactions !== undefined ? prefs.likes_reactions : existing.reactions),
      comments: prefs.comments !== undefined ? prefs.comments : (prefs.comments_mentions !== undefined ? prefs.comments_mentions : existing.comments),
      followers: prefs.followers !== undefined ? prefs.followers : existing.followers,
      events: prefs.events !== undefined ? prefs.events : (prefs.events_reminders !== undefined ? prefs.events_reminders : existing.events),
      careers: prefs.careers !== undefined ? prefs.careers : (prefs.career_alerts !== undefined ? prefs.career_alerts : existing.careers),
      schemes: prefs.schemes !== undefined ? prefs.schemes : (prefs.schemes_updates !== undefined ? prefs.schemes_updates : existing.schemes),
      system_alerts: prefs.system_alerts !== undefined ? prefs.system_alerts : existing.system_alerts,
      pause_all: prefs.pause_all !== undefined ? prefs.pause_all : existing.pause_all,
      sound_vibrate: prefs.sound_vibrate !== undefined ? prefs.sound_vibrate : existing.sound_vibrate,
    };

    try {
      const res = await query(
        `INSERT INTO notification_preferences (
          user_id, messages, reactions, comments, followers, events, careers, schemes, system_alerts, pause_all, sound_vibrate, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          messages = EXCLUDED.messages,
          reactions = EXCLUDED.reactions,
          comments = EXCLUDED.comments,
          followers = EXCLUDED.followers,
          events = EXCLUDED.events,
          careers = EXCLUDED.careers,
          schemes = EXCLUDED.schemes,
          system_alerts = EXCLUDED.system_alerts,
          pause_all = EXCLUDED.pause_all,
          sound_vibrate = EXCLUDED.sound_vibrate,
          updated_at = NOW()
        RETURNING *`,
        [
          userId,
          updated.messages,
          updated.reactions,
          updated.comments,
          updated.followers,
          updated.events,
          updated.careers,
          updated.schemes,
          updated.system_alerts,
          updated.pause_all,
          updated.sound_vibrate,
        ]
      );
      return res.rows[0];
    } catch (e: any) {
      logger.warn('[NotificationService.updatePreferences] Warning: ' + e.message);
      return updated;
    }
  }
}
