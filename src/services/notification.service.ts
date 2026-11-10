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

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN PUSH NOTIFICATION BROADCAST MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Estimates the recipient audience count for an Admin Broadcast based on filters and preferences.
   */
  static async estimateBroadcastAudience(
    targetAudience: string = 'all',
    targetCriteria: any = {},
    isMandatory: boolean = false,
    category: string = 'announcement'
  ) {
    try {
      let roleFilter = '';
      if (targetAudience === 'users') {
        roleFilter = `AND u.role = 'user'`;
      } else if (targetAudience === 'organizations') {
        roleFilter = `AND u.role = 'organization'`;
      } else if (targetAudience === 'admins') {
        roleFilter = `AND u.role = 'admin'`;
      }

      let criteriaFilter = '';
      const params: any[] = [];
      let paramIdx = 1;

      if (targetCriteria?.userIds && Array.isArray(targetCriteria.userIds) && targetCriteria.userIds.length > 0) {
        criteriaFilter += ` AND u.id = ANY($${paramIdx})`;
        params.push(targetCriteria.userIds);
        paramIdx++;
      }

      // Query active user devices
      const deviceQuery = `
        SELECT 
          COUNT(DISTINCT u.id) as user_count,
          COUNT(DISTINCT ud.fcm_token) as device_count,
          COUNT(DISTINCT CASE WHEN ud.platform = 'android' THEN ud.fcm_token END) as android_count,
          COUNT(DISTINCT CASE WHEN ud.platform = 'ios' THEN ud.fcm_token END) as ios_count,
          COUNT(DISTINCT CASE WHEN ud.platform = 'web' THEN ud.fcm_token END) as web_count
        FROM users u
        LEFT JOIN user_devices ud ON ud.user_id = u.id AND ud.is_active = TRUE AND ud.fcm_token IS NOT NULL
        LEFT JOIN notification_preferences np ON np.user_id = u.id
        WHERE 1=1 ${roleFilter} ${criteriaFilter}
        ${!isMandatory ? `AND (np.pause_all IS NULL OR np.pause_all = FALSE)` : ''}
      `;

      const res = await query(deviceQuery, params);
      const row = res.rows[0] || {};

      return {
        totalUsers: parseInt(row.user_count || '0', 10),
        totalDevices: parseInt(row.device_count || '0', 10),
        androidDevices: parseInt(row.android_count || '0', 10),
        iosDevices: parseInt(row.ios_count || '0', 10),
        webDevices: parseInt(row.web_count || '0', 10),
      };
    } catch (err: any) {
      logger.error('[estimateBroadcastAudience] Error: ' + err.message);
      return { totalUsers: 0, totalDevices: 0, androidDevices: 0, iosDevices: 0, webDevices: 0 };
    }
  }

  /**
   * Creates an Admin Broadcast record (draft or scheduled).
   */
  static async createBroadcast(data: any, adminUserId: string, adminName: string) {
    const {
      title,
      body,
      imageUrl,
      category = 'announcement',
      priority = 'normal',
      deepLink,
      actionLabel,
      targetAudience = 'all',
      targetCriteria = {},
      isMandatory = false,
      scheduledAt,
    } = data;

    const initialStatus = scheduledAt ? 'scheduled' : 'draft';

    const res = await query(
      `INSERT INTO notification_broadcasts (
        title, body, image_url, category, priority, deep_link, action_label,
        target_audience, target_criteria, is_mandatory, status, scheduled_at,
        created_by, created_by_name, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        title,
        body,
        imageUrl || null,
        category,
        priority,
        deepLink || null,
        actionLabel || null,
        targetAudience,
        JSON.stringify(targetCriteria),
        isMandatory,
        initialStatus,
        scheduledAt ? new Date(scheduledAt) : null,
        adminUserId,
        adminName,
      ]
    );

    return res.rows[0];
  }

  /**
   * Dispatches an Admin Broadcast to target audience devices and persists delivery metrics.
   */
  static async sendBroadcast(broadcastId: string) {
    // 1. Fetch broadcast details
    const bRes = await query(`SELECT * FROM notification_broadcasts WHERE id = $1`, [broadcastId]);
    if (!bRes.rows || bRes.rows.length === 0) {
      throw new Error('Broadcast not found');
    }
    const broadcast = bRes.rows[0];

    if (broadcast.status === 'sent') {
      throw new Error('Broadcast has already been sent');
    }
    if (broadcast.status === 'processing') {
      throw new Error('Broadcast is currently being processed');
    }

    // Set status to processing
    await query(`UPDATE notification_broadcasts SET status = 'processing', updated_at = NOW() WHERE id = $1`, [broadcastId]);

    try {
      // 2. Resolve audience
      let roleFilter = '';
      if (broadcast.target_audience === 'users') {
        roleFilter = `AND u.role = 'user'`;
      } else if (broadcast.target_audience === 'organizations') {
        roleFilter = `AND u.role = 'organization'`;
      } else if (broadcast.target_audience === 'admins') {
        roleFilter = `AND u.role = 'admin'`;
      }

      let criteriaFilter = '';
      const params: any[] = [];
      let paramIdx = 1;

      const criteria = typeof broadcast.target_criteria === 'string'
        ? JSON.parse(broadcast.target_criteria)
        : (broadcast.target_criteria || {});

      if (criteria?.userIds && Array.isArray(criteria.userIds) && criteria.userIds.length > 0) {
        criteriaFilter += ` AND u.id = ANY($${paramIdx})`;
        params.push(criteria.userIds);
        paramIdx++;
      }

      // Query target users and their active device tokens
      const recipientsQuery = `
        SELECT 
          u.id as user_id,
          u.full_name,
          ud.fcm_token,
          ud.platform,
          np.pause_all,
          np.events,
          np.careers,
          np.schemes,
          np.system_alerts
        FROM users u
        LEFT JOIN user_devices ud ON ud.user_id = u.id AND ud.is_active = TRUE AND ud.fcm_token IS NOT NULL
        LEFT JOIN notification_preferences np ON np.user_id = u.id
        WHERE 1=1 ${roleFilter} ${criteriaFilter}
      `;

      const recRes = await query(recipientsQuery, params);
      const rows = recRes.rows || [];

      // Group by user and filter by preferences if not mandatory
      const distinctUsers = new Set<string>();
      const validTargets: { userId: string; token: string; platform: string }[] = [];

      for (const row of rows) {
        distinctUsers.add(row.user_id);

        if (!broadcast.is_mandatory) {
          if (row.pause_all === true) continue;
          if (broadcast.category === 'event' && row.events === false) continue;
          if (broadcast.category === 'career' && row.careers === false) continue;
          if (broadcast.category === 'scheme' && row.schemes === false) continue;
          if (broadcast.category === 'system' && row.system_alerts === false) continue;
        }

        if (row.fcm_token) {
          validTargets.push({
            userId: row.user_id,
            token: row.fcm_token,
            platform: row.platform || 'android',
          });
        }
      }

      const totalTargeted = validTargets.length;
      let totalSent = 0;
      let totalFailed = 0;

      // Prepare payload
      const dataPayload: Record<string, string> = {
        type: 'broadcast',
        broadcastId: broadcast.id,
        category: broadcast.category || 'announcement',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        deepLink: broadcast.deep_link || '',
        sentAt: new Date().toISOString(),
      };

      if (broadcast.deep_link) {
        dataPayload.route = broadcast.deep_link;
      }

      const sendOptions = {
        imageUrl: broadcast.image_url || undefined,
        priority: broadcast.priority || 'normal',
      };

      // 3. Multicast in chunks of 500
      const tokens = validTargets.map(t => t.token);
      if (tokens.length > 0) {
        const sendResult = await FcmIntegration.sendMulticast(
          tokens,
          broadcast.title,
          broadcast.body,
          dataPayload,
          sendOptions
        );

        totalSent = sendResult.successCount;
        totalFailed = sendResult.failureCount;

        // Deactivate bad tokens
        if (sendResult.invalidTokens.length > 0) {
          await query(
            `UPDATE user_devices SET is_active = FALSE, updated_at = NOW() WHERE fcm_token = ANY($1)`,
            [sendResult.invalidTokens]
          ).catch(() => {});
        }
      }

      // 4. Batch insert into in-app notifications so all targeted users have it in notification center
      const uniqueTargetUserIds = Array.from(distinctUsers);
      for (const uid of uniqueTargetUserIds) {
        await query(
          `INSERT INTO notifications (user_id, type, title, body, data, created_at)
           VALUES ($1, 'broadcast', $2, $3, $4, NOW())`,
          [uid, broadcast.title, broadcast.body, JSON.stringify(dataPayload)]
        ).catch(() => {});
      }

      // 5. Update broadcast status and metrics
      const updatedRes = await query(
        `UPDATE notification_broadcasts
         SET 
           status = 'sent',
           total_targeted = $1,
           total_sent = $2,
           total_failed = $3,
           sent_at = NOW(),
           completed_at = NOW(),
           updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [totalTargeted, totalSent, totalFailed, broadcastId]
      );

      return updatedRes.rows[0];
    } catch (err: any) {
      await query(
        `UPDATE notification_broadcasts SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [broadcastId]
      ).catch(() => {});
      logger.error('[sendBroadcast] Critical failure: ' + err.message);
      throw err;
    }
  }

  /**
   * Lists broadcasts with pagination, search, and aggregated dashboard metrics.
   */
  static async listBroadcasts(page: number = 1, limit: number = 20, status?: string) {
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'all') {
      whereClause += ` AND status = $1`;
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM notification_broadcasts ${whereClause}`;
    const listQuery = `
      SELECT * FROM notification_broadcasts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRes, itemsRes, statsRes] = await Promise.all([
      query(countQuery, params),
      query(listQuery, [...params, limit, offset]),
      query(`
        SELECT 
          COUNT(*) as total_broadcasts,
          COALESCE(SUM(total_sent), 0) as total_delivered,
          COALESCE(SUM(total_failed), 0) as total_failed,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as total_scheduled,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as total_drafts
        FROM notification_broadcasts
      `),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const statsRow = statsRes.rows[0] || {};

    const metrics = {
      totalBroadcasts: parseInt(statsRow.total_broadcasts || '0', 10),
      totalDelivered: parseInt(statsRow.total_delivered || '0', 10),
      totalFailed: parseInt(statsRow.total_failed || '0', 10),
      totalScheduled: parseInt(statsRow.total_scheduled || '0', 10),
      totalDrafts: parseInt(statsRow.total_drafts || '0', 10),
    };

    return {
      ...buildPaginatedResult(itemsRes.rows, total, page, limit),
      metrics,
    };
  }

  /**
   * Retrieves single broadcast details along with recipient logs.
   */
  static async getBroadcastDetails(broadcastId: string) {
    const res = await query(`SELECT * FROM notification_broadcasts WHERE id = $1`, [broadcastId]);
    if (!res.rows || res.rows.length === 0) return null;

    const broadcast = res.rows[0];

    // Get sample recipient statuses
    const recRes = await query(
      `SELECT nbr.*, u.full_name, u.email
       FROM notification_broadcast_recipients nbr
       LEFT JOIN users u ON u.id = nbr.user_id
       WHERE nbr.broadcast_id = $1
       ORDER BY nbr.created_at DESC
       LIMIT 50`,
      [broadcastId]
    ).catch(() => ({ rows: [] }));

    return {
      broadcast,
      recentRecipients: recRes.rows,
    };
  }

  /**
   * Cancels a scheduled or draft broadcast.
   */
  static async cancelBroadcast(broadcastId: string) {
    const res = await query(
      `UPDATE notification_broadcasts 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 AND status IN ('draft', 'scheduled')
       RETURNING *`,
      [broadcastId]
    );
    if (!res.rows || res.rows.length === 0) {
      throw new Error('Broadcast cannot be cancelled (must be in draft or scheduled state)');
    }
    return res.rows[0];
  }

  /**
   * Retries sending to failed recipients of a broadcast.
   */
  static async retryFailedRecipients(broadcastId: string) {
    const bRes = await query(`SELECT * FROM notification_broadcasts WHERE id = $1`, [broadcastId]);
    if (!bRes.rows || bRes.rows.length === 0) throw new Error('Broadcast not found');
    const broadcast = bRes.rows[0];

    // Find failed tokens
    const failedRes = await query(
      `SELECT nbr.*, ud.fcm_token
       FROM notification_broadcast_recipients nbr
       JOIN user_devices ud ON ud.user_id = nbr.user_id AND ud.is_active = TRUE
       WHERE nbr.broadcast_id = $1 AND nbr.status = 'failed'`,
      [broadcastId]
    ).catch(() => ({ rows: [] }));

    const tokens = failedRes.rows.map(r => r.fcm_token).filter(Boolean);
    if (tokens.length === 0) {
      return { retried: 0, message: 'No failed recipients eligible for retry' };
    }

    const dataPayload: Record<string, string> = {
      type: 'broadcast_retry',
      broadcastId: broadcast.id,
      category: broadcast.category || 'announcement',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    };

    const res = await FcmIntegration.sendMulticast(tokens, broadcast.title, broadcast.body, dataPayload);
    return {
      retried: tokens.length,
      successCount: res.successCount,
      failureCount: res.failureCount,
    };
  }
}
