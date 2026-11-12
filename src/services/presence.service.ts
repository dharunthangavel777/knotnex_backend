import { query } from '../config/database';
import { logger } from '../config/logger';

export interface UserPrivacySettings {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  readReceiptsEnabled: boolean;
  allowMessageRequests: boolean;
}

export interface UserPresenceSnapshot {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  readReceiptsEnabled: boolean;
}

const DEFAULT_PRIVACY: UserPrivacySettings = {
  showOnlineStatus: true,
  showLastSeen: true,
  readReceiptsEnabled: true,
  allowMessageRequests: true,
};

/**
 * Tracks multi-device / multi-socket Socket.IO connections, maintains persistent
 * `user_presence` state, and enforces messaging privacy settings.
 */
export class PresenceService {
  private static readonly userSockets = new Map<string, Set<string>>();

  /**
   * Records a new active socket connection for `userId`.
   * Returns `{ becameOnline, presence, showOnlineStatus }` so socket layer only
   * broadcasts when appropriate and respects privacy settings.
   */
  static async onSocketConnected(userId: string, socketId: string): Promise<{
    becameOnline: boolean;
    showOnlineStatus: boolean;
    showLastSeen: boolean;
    socketCount: number;
  }> {
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set<string>();
      this.userSockets.set(userId, sockets);
    }
    const wasEmpty = sockets.size === 0;
    sockets.add(socketId);
    const socketCount = sockets.size;

    const privacy = await this.getPrivacySettings(userId);

    try {
      await query(
        `INSERT INTO user_presence (user_id, is_online, last_seen_at, active_socket_count, last_heartbeat_at, updated_at)
         VALUES ($1, $2, NULL, $3, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           is_online = $2,
           active_socket_count = GREATEST($3, 1),
           last_heartbeat_at = NOW(),
           updated_at = NOW()`,
        [userId, true, socketCount]
      );
    } catch (err: any) {
      logger.warn('[PresenceService.onSocketConnected] DB update skipped: ' + err.message);
    }

    return {
      becameOnline: wasEmpty,
      showOnlineStatus: privacy.showOnlineStatus,
      showLastSeen: privacy.showLastSeen,
      socketCount,
    };
  }

  /**
   * Removes a disconnected socket for `userId`.
   * Only marks the user offline and records `last_seen_at` when their last active
   * socket closes across this process.
   */
  static async onSocketDisconnected(userId: string, socketId: string): Promise<{
    becameOffline: boolean;
    lastSeenAt: string | null;
    showOnlineStatus: boolean;
    showLastSeen: boolean;
  }> {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    const remaining = this.userSockets.get(userId)?.size ?? 0;
    const becameOffline = remaining === 0;
    const nowIso = new Date().toISOString();

    const privacy = await this.getPrivacySettings(userId);

    try {
      if (becameOffline) {
        await query(
          `INSERT INTO user_presence (user_id, is_online, last_seen_at, active_socket_count, updated_at)
           VALUES ($1, FALSE, $2, 0, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             is_online = FALSE,
             last_seen_at = $2,
             active_socket_count = 0,
             updated_at = NOW()`,
          [userId, nowIso]
        );
      } else {
        await query(
          `UPDATE user_presence SET active_socket_count = $2, updated_at = NOW() WHERE user_id = $1`,
          [userId, remaining]
        );
      }
    } catch (err: any) {
      logger.warn('[PresenceService.onSocketDisconnected] DB update skipped: ' + err.message);
    }

    return {
      becameOffline,
      lastSeenAt: privacy.showLastSeen ? nowIso : null,
      showOnlineStatus: privacy.showOnlineStatus,
      showLastSeen: privacy.showLastSeen,
    };
  }

  static async onHeartbeat(userId: string): Promise<void> {
    try {
      await query(
        `INSERT INTO user_presence (user_id, is_online, last_heartbeat_at, updated_at)
         VALUES ($1, TRUE, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           is_online = TRUE,
           last_heartbeat_at = NOW(),
           updated_at = NOW()`,
        [userId]
      );
    } catch (_) {
      // Ignore heartbeat failure if migration hasn't run yet
    }
  }

  static isUserLocallyConnected(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  static async getPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    try {
      const res = await query(
        `SELECT show_online_status, show_last_seen, read_receipts_enabled, allow_message_requests
         FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      if (res.rows.length === 0) return { ...DEFAULT_PRIVACY };
      const row = res.rows[0];
      return {
        showOnlineStatus: row.show_online_status !== false,
        showLastSeen: row.show_last_seen !== false,
        readReceiptsEnabled: row.read_receipts_enabled !== false,
        allowMessageRequests: row.allow_message_requests !== false,
      };
    } catch (_) {
      return { ...DEFAULT_PRIVACY };
    }
  }

  static async updatePrivacySettings(
    userId: string,
    patch: Partial<UserPrivacySettings>
  ): Promise<UserPrivacySettings> {
    const current = await this.getPrivacySettings(userId);
    const next: UserPrivacySettings = {
      showOnlineStatus:
        patch.showOnlineStatus !== undefined ? Boolean(patch.showOnlineStatus) : current.showOnlineStatus,
      showLastSeen: patch.showLastSeen !== undefined ? Boolean(patch.showLastSeen) : current.showLastSeen,
      readReceiptsEnabled:
        patch.readReceiptsEnabled !== undefined ? Boolean(patch.readReceiptsEnabled) : current.readReceiptsEnabled,
      allowMessageRequests:
        patch.allowMessageRequests !== undefined ? Boolean(patch.allowMessageRequests) : current.allowMessageRequests,
    };

    await query(
      `UPDATE users
       SET show_online_status = $2,
           show_last_seen = $3,
           read_receipts_enabled = $4,
           allow_message_requests = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, next.showOnlineStatus, next.showLastSeen, next.readReceiptsEnabled, next.allowMessageRequests]
    );

    return next;
  }

  /**
   * Computes privacy-respecting presence snapshots for a set of target users.
   * Mutual blocks hide online status and last_seen_at unconditionally.
   */
  static async getPresenceForUsers(
    viewerId: string,
    targetUserIds: string[]
  ): Promise<Record<string, UserPresenceSnapshot>> {
    const cleanIds = Array.from(new Set(targetUserIds.filter(Boolean)));
    const result: Record<string, UserPresenceSnapshot> = {};
    if (cleanIds.length === 0) return result;

    try {
      const res = await query(
        `SELECT
            u.id AS user_id,
            COALESCE(u.show_online_status, TRUE) AS show_online_status,
            COALESCE(u.show_last_seen, TRUE) AS show_last_seen,
            COALESCE(u.read_receipts_enabled, TRUE) AS read_receipts_enabled,
            COALESCE(up.is_online, FALSE) AS raw_is_online,
            up.last_seen_at AS raw_last_seen_at,
            up.last_heartbeat_at,
            EXISTS (
              SELECT 1 FROM blocked_users b
              WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                 OR (b.blocker_id = u.id AND b.blocked_id = $1)
            ) AS is_blocked
         FROM users u
         LEFT JOIN user_presence up ON up.user_id = u.id
         WHERE u.id = ANY($2::uuid[])`,
        [viewerId, cleanIds]
      );

      const staleCutoffMs = 3 * 60 * 1000;
      const nowMs = Date.now();

      for (const row of res.rows) {
        const uid = String(row.user_id);
        const isBlocked = Boolean(row.is_blocked);
        const showOnline = !isBlocked && row.show_online_status !== false;
        const showLastSeen = !isBlocked && row.show_last_seen !== false;

        let rawOnline = this.isUserLocallyConnected(uid) || Boolean(row.raw_is_online);
        if (rawOnline && !this.isUserLocallyConnected(uid) && row.last_heartbeat_at) {
          const hbMs = new Date(row.last_heartbeat_at).getTime();
          if (Number.isFinite(hbMs) && nowMs - hbMs > staleCutoffMs) {
            rawOnline = false;
          }
        }

        const isOnline = showOnline && rawOnline;
        const lastSeenAt =
          !isOnline && showLastSeen && row.raw_last_seen_at
            ? new Date(row.raw_last_seen_at).toISOString()
            : null;

        result[uid] = {
          userId: uid,
          isOnline,
          lastSeenAt,
          showOnlineStatus: showOnline,
          showLastSeen,
          readReceiptsEnabled: row.read_receipts_enabled !== false,
        };
      }
    } catch (err: any) {
      logger.warn('[PresenceService.getPresenceForUsers] Query fallback: ' + err.message);
      for (const uid of cleanIds) {
        result[uid] = {
          userId: uid,
          isOnline: this.isUserLocallyConnected(uid),
          lastSeenAt: null,
          showOnlineStatus: true,
          showLastSeen: true,
          readReceiptsEnabled: true,
        };
      }
    }

    return result;
  }
}
