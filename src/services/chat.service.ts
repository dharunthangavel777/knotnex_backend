import { query } from '../config/database';
import { logger } from '../config/logger';
import { getSocketIO } from '../websockets/socket.server';
import { NotificationService } from './notification.service';
import { firestore } from '../config/firebase';
import { COLLECTIONS } from '../config/firestore';
import { AttachmentInput, ChatMessagingService } from './chat-messaging.service';
import { PresenceService } from './presence.service';

export interface SendMessagePayload {
  conversationId?: string;
  senderId: string;
  recipientId?: string;
  content: string;
  messageType?: string;
  mediaUrl?: string;
  replyToId?: string;
  clientMessageId?: string;
  forwardedFromMessageId?: string;
  metadata?: any;
  attachments?: AttachmentInput[];
}

export class ChatService {
  /**
   * Resolves any user identifier (Postgres UUID, Firebase UID, Email, Username, or handle)
   * to a valid Postgres UUID from the users table. Auto-provisions a record if missing.
   */
  static async resolveUserUuid(identifier: string): Promise<string | null> {
    if (!identifier) return null;
    const clean = identifier.trim();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(clean)) {
      try {
        const res = await query('SELECT id FROM users WHERE id = $1 LIMIT 1', [clean]);
        if (res.rowCount && res.rowCount > 0) return res.rows[0].id;
        return clean;
      } catch (_) {
        return clean;
      }
    }

    try {
      // 1. By firebase_uid
      const fbRes = await query('SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1', [clean]);
      if (fbRes.rowCount && fbRes.rowCount > 0) return fbRes.rows[0].id;

      // 2. By email
      if (clean.includes('@')) {
        const emailRes = await query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [clean.toLowerCase()]);
        if (emailRes.rowCount && emailRes.rowCount > 0) return emailRes.rows[0].id;
      }

      // 3. By username (handling @ or user_ prefixes)
      const usernameClean = clean.replace(/^@/, '').replace(/^user_/, '');
      const userRes = await query(
        'SELECT id FROM users WHERE LOWER(username) = $1 OR LOWER(username) = $2 LIMIT 1',
        [clean.toLowerCase(), usernameClean.toLowerCase()]
      );
      if (userRes.rowCount && userRes.rowCount > 0) return userRes.rows[0].id;

      // 4. Auto-provision stub user to ensure foreign-key constraints never crash
      const autoEmail = clean.includes('@') ? clean.toLowerCase() : `${clean.toLowerCase().replace(/[^a-z0-9]/g, '_')}@knotnex.user`;
      const autoName = clean.startsWith('user_') ? clean.substring(5) : clean;
      const stubRes = await query(
        `INSERT INTO users (firebase_uid, email, full_name, username, role, is_verified)
         VALUES ($1, $2, $3, $4, 'user', TRUE)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [clean, autoEmail, autoName, usernameClean]
      );
      if (stubRes.rowCount && stubRes.rowCount > 0) {
        return stubRes.rows[0].id;
      }
    } catch (e: any) {
      logger.warn('[ChatService.resolveUserUuid] Resolution error: ' + e.message);
    }

    return null;
  }

  /**
   * Validates if a user is an authorized participant in a conversation.
   */
  static async verifyParticipant(conversationId: string, userId: string): Promise<boolean> {
    try {
      const uId = (await this.resolveUserUuid(userId)) || userId;
      const res = await query(
        `SELECT 1 FROM conversations 
         WHERE id = $1 AND (participant_one = $2 OR participant_two = $2)
         LIMIT 1`,
        [conversationId, uId]
      );
      if (res.rowCount && res.rowCount > 0) return true;

      // Fallback check against Firestore if table is empty or legacy doc
      try {
        const doc = await firestore.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).get();
        if (doc.exists) {
          const parts = (doc.data()?.participants as string[]) || [];
          return parts.includes(userId) || parts.includes(uId);
        }
      } catch (_) {}

      return false;
    } catch (e: any) {
      logger.warn('[ChatService.verifyParticipant] Verification error: ' + e.message);
      return false;
    }
  }

  /**
   * Lists all conversations for the authenticated user, enriched with peer details and unread counts.
   */
  static async listUserConversations(userId: string, archived: boolean = false) {
    try {
      const uId = (await this.resolveUserUuid(userId)) || userId;
      const res = await query(
        `SELECT 
            c.id,
            c.participant_one,
            c.participant_two,
            COALESCE(c.status, 'ACCEPTED') AS status,
            c.initiator_id,
            ($1 = ANY(COALESCE(c.pinned_by, '{}'))) AS is_pinned,
            ($1 = ANY(COALESCE(c.archived_by, '{}'))) AS is_archived,
            (
              ($1 = ANY(COALESCE(c.muted_by, '{}')))
              OR (COALESCE(cp.is_muted, FALSE) = TRUE AND (cp.muted_until IS NULL OR cp.muted_until > NOW()))
            ) AS is_muted,
            cp.muted_until,
            cp.cleared_before_at,
            c.last_message,
            c.last_message_at,
            c.last_message_by,
            c.created_at,
            c.updated_at,
            CASE 
              WHEN c.participant_one = $1 THEN c.participant_two 
              ELSE c.participant_one 
            END AS other_user_id,
            COALESCE(
              cp.unread_count,
              CASE WHEN c.participant_one = $1 THEN c.unread_count_one ELSE c.unread_count_two END,
              0
            ) AS unread_count,
            u.full_name AS other_user_name,
            COALESCE(u.username, SPLIT_PART(u.email, '@', 1)) AS other_user_username,
            u.avatar_url AS other_user_avatar,
            u.role AS other_user_role,
            COALESCE(u.is_verified, FALSE) AS other_user_verified,
            up.bio AS other_user_bio,
            org.name AS other_org_name,
            org.logo_url AS other_org_logo,
            COALESCE(org.is_verified, FALSE) AS other_org_verified
         FROM conversations c
         JOIN users u ON u.id = (
           CASE WHEN c.participant_one = $1 THEN c.participant_two ELSE c.participant_one END
         )
         LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
         LEFT JOIN user_profiles up ON up.user_id = u.id
         LEFT JOIN organizations org ON org.owner_id = u.id
         WHERE (c.participant_one = $1 OR c.participant_two = $1)
           AND NOT ($1 = ANY(COALESCE(c.deleted_by, '{}')))
           AND COALESCE(cp.is_deleted, FALSE) = FALSE
           AND (
             ($2 = TRUE AND ($1 = ANY(COALESCE(c.archived_by, '{}'))))
             OR ($2 = FALSE AND NOT ($1 = ANY(COALESCE(c.archived_by, '{}'))))
           )
           AND (COALESCE(c.status, 'ACCEPTED') = 'ACCEPTED' OR c.initiator_id = $1)
         ORDER BY ($1 = ANY(COALESCE(c.pinned_by, '{}'))) DESC, c.last_message_at DESC NULLS LAST`,
        [uId, archived]
      );

      if (res.rows && res.rows.length > 0) {
        const peerIds = res.rows.map((r) => String(r.other_user_id));
        const presenceMap = await PresenceService.getPresenceForUsers(uId, peerIds);

        return res.rows.map((row) => {
          const peerId = String(row.other_user_id);
          const presence = presenceMap[peerId];
          const displayName = row.other_org_name || row.other_user_name || 'User';
          const avatarUrl = row.other_org_logo || row.other_user_avatar || '';
          const isVerified = Boolean(row.other_org_verified || row.other_user_verified);
          const clearedBefore = row.cleared_before_at ? new Date(row.cleared_before_at).getTime() : null;
          const lastMsgAt = row.last_message_at ? new Date(row.last_message_at).getTime() : null;
          const hideClearedPreview = clearedBefore !== null && lastMsgAt !== null && lastMsgAt <= clearedBefore;

          const otherUser = {
            id: row.other_user_id,
            name: displayName,
            username: row.other_user_username || 'user',
            email: `${row.other_user_username || 'user'}@knotnex.com`,
            avatar_url: avatarUrl,
            photoUrl: avatarUrl,
            bio: row.other_user_bio || 'KnotNex Member',
            role: row.other_user_role,
            is_online: presence?.isOnline ?? false,
            isOnline: presence?.isOnline ?? false,
            last_seen_at: presence?.lastSeenAt ?? null,
            lastSeenAt: presence?.lastSeenAt ?? null,
            show_online_status: presence?.showOnlineStatus ?? true,
            show_last_seen: presence?.showLastSeen ?? true,
            read_receipts_enabled: presence?.readReceiptsEnabled ?? true,
            is_verified: isVerified,
            isVerified,
          };

          return {
            id: row.id,
            participants: [row.participant_one, row.participant_two],
            status: row.status,
            initiator_id: row.initiator_id,
            initiatorId: row.initiator_id,
            is_pinned: row.is_pinned,
            isPinned: row.is_pinned,
            is_archived: row.is_archived,
            isArchived: row.is_archived,
            is_muted: Boolean(row.is_muted),
            isMuted: Boolean(row.is_muted),
            muted_until: row.muted_until,
            mutedUntil: row.muted_until,
            last_message: hideClearedPreview ? '' : row.last_message || '',
            lastMessage: hideClearedPreview ? '' : row.last_message || '',
            last_message_at: row.last_message_at,
            lastMessageAt: row.last_message_at,
            last_message_by: row.last_message_by,
            unread_count: parseInt(row.unread_count || '0', 10),
            unreadCount: parseInt(row.unread_count || '0', 10),
            other_user: otherUser,
            participant: otherUser,
            created_at: row.created_at,
          };
        });
      }

      // Legacy fallback to Firestore if SQL returns no rows
      return this.listFirestoreConversations(uId);
    } catch (err: any) {
      logger.error('[ChatService.listUserConversations] SQL error, attempting Firestore fallback: ' + err.message);
      return this.listFirestoreConversations(userId);
    }
  }

  /**
   * Lists incoming stranger message requests for the authenticated user.
   */
  static async listMessageRequests(userId: string) {
    try {
      const uId = (await this.resolveUserUuid(userId)) || userId;
      const res = await query(
        `SELECT 
            c.id,
            c.participant_one,
            c.participant_two,
            c.status,
            c.initiator_id,
            c.last_message,
            c.last_message_at,
            c.last_message_by,
            c.created_at,
            c.updated_at,
            CASE 
              WHEN c.participant_one = $1 THEN c.participant_two 
              ELSE c.participant_one 
            END AS other_user_id,
            CASE 
              WHEN c.participant_one = $1 THEN c.unread_count_one 
              ELSE c.unread_count_two 
            END AS unread_count,
            u.full_name AS other_user_name,
            COALESCE(u.username, SPLIT_PART(u.email, '@', 1)) AS other_user_username,
            u.avatar_url AS other_user_avatar,
            u.role AS other_user_role,
            COALESCE(u.is_verified, FALSE) AS other_user_verified,
            up.bio AS other_user_bio,
            org.name AS other_org_name,
            org.logo_url AS other_org_logo,
            COALESCE(org.is_verified, FALSE) AS other_org_verified
         FROM conversations c
         JOIN users u ON u.id = (
           CASE WHEN c.participant_one = $1 THEN c.participant_two ELSE c.participant_one END
         )
         LEFT JOIN user_profiles up ON up.user_id = u.id
         LEFT JOIN organizations org ON org.owner_id = u.id
         WHERE (c.participant_one = $1 OR c.participant_two = $1)
           AND c.status = 'REQUEST_PENDING'
           AND c.initiator_id <> $1
           AND NOT ($1 = ANY(COALESCE(c.deleted_by, '{}')))
         ORDER BY c.last_message_at DESC NULLS LAST`,
        [uId]
      );

      const peerIds = (res.rows || []).map((r) => String(r.other_user_id));
      const presenceMap = await PresenceService.getPresenceForUsers(uId, peerIds);

      return (res.rows || []).map((row) => {
        const peerId = String(row.other_user_id);
        const presence = presenceMap[peerId];
        const displayName = row.other_org_name || row.other_user_name || 'User';
        const avatarUrl = row.other_org_logo || row.other_user_avatar || '';
        const isVerified = Boolean(row.other_org_verified || row.other_user_verified);
        const otherUser = {
          id: row.other_user_id,
          name: displayName,
          username: row.other_user_username || 'user',
          email: `${row.other_user_username || 'user'}@knotnex.com`,
          avatar_url: avatarUrl,
          photoUrl: avatarUrl,
          bio: row.other_user_bio || 'KnotNex Member',
          role: row.other_user_role,
          is_online: presence?.isOnline ?? false,
          isOnline: presence?.isOnline ?? false,
          last_seen_at: presence?.lastSeenAt ?? null,
          lastSeenAt: presence?.lastSeenAt ?? null,
          is_verified: isVerified,
          isVerified,
        };

        return {
          id: row.id,
          participants: [row.participant_one, row.participant_two],
          status: row.status,
          initiator_id: row.initiator_id,
          initiatorId: row.initiator_id,
          last_message: row.last_message || '',
          lastMessage: row.last_message || '',
          last_message_at: row.last_message_at,
          lastMessageAt: row.last_message_at,
          last_message_by: row.last_message_by,
          unread_count: parseInt(row.unread_count || '0', 10),
          unreadCount: parseInt(row.unread_count || '0', 10),
          other_user: otherUser,
          participant: otherUser,
          created_at: row.created_at,
        };
      });
    } catch (err: any) {
      logger.error('[ChatService.listMessageRequests] error: ' + err.message);
      return [];
    }
  }

  /**
   * Retrieves paginated messages for a conversation or target user with full metadata & attachments.
   */
  static async getConversationOrDirectMessages(
    currentUserId: string,
    targetId: string,
    limit: number = 35,
    offsetOrOpts: number | { before?: string; after?: string; aroundMessageId?: string } = {}
  ) {
    try {
      const uId = (await this.resolveUserUuid(currentUserId)) || currentUserId;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      let resolvedTarget = targetId;
      if (!uuidRegex.test(targetId)) {
        resolvedTarget = (await this.resolveUserUuid(targetId)) || targetId;
      }

      const opts = typeof offsetOrOpts === 'object' && offsetOrOpts !== null ? offsetOrOpts : {};
      return await ChatMessagingService.getConversationMessagesPaginated(uId, resolvedTarget, {
        limit,
        before: opts.before,
        after: opts.after,
        aroundMessageId: opts.aroundMessageId,
      });
    } catch (err: any) {
      if (err?.statusCode === 403) throw err;
      logger.error('[ChatService.getConversationOrDirectMessages] SQL error, attempting Firestore fallback: ' + err.message);
      return {
        conversationId: targetId,
        status: 'ACCEPTED',
        initiatorId: null,
        hasMore: false,
        messages: await this.getFirestoreConversationMessages(targetId, limit),
      };
    }
  }

  /**
   * Starts or retrieves a 1-on-1 conversation between two accounts.
   * Eliminates all follower/following dependency: anyone can initiate a message request.
   */
  static async startConversation(creatorId: string, participantId: string) {
    const cId = (await this.resolveUserUuid(creatorId)) || creatorId;
    const pId = (await this.resolveUserUuid(participantId)) || participantId;

    if (cId === pId) {
      throw new Error('Cannot start conversation with yourself');
    }

    // Check if communication is blocked
    const blockCheck = await query(
      `SELECT 1 FROM blocked_users 
       WHERE (blocker_id = $1 AND blocked_id = $2) 
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [cId, pId]
    );

    if (blockCheck.rowCount && blockCheck.rowCount > 0) {
      throw new Error('Communication is blocked between these accounts');
    }

    // Find or create pairwise conversation
    const part1 = cId < pId ? cId : pId;
    const part2 = cId < pId ? pId : cId;

    const findRes = await query(
      `SELECT * FROM conversations 
       WHERE (participant_one = $1 AND participant_two = $2)
          OR (participant_one = $2 AND participant_two = $1)
       LIMIT 1`,
      [part1, part2]
    );

    if (findRes.rowCount && findRes.rowCount > 0) {
      await query(
        `UPDATE conversations 
         SET deleted_by = array_remove(COALESCE(deleted_by, '{}'), $1) 
         WHERE id = $2`,
        [cId, findRes.rows[0].id]
      ).catch(() => {});
      return findRes.rows[0];
    }

    const insertRes = await query(
      `INSERT INTO conversations (participant_one, participant_two, status, initiator_id, last_message_at, created_at, updated_at)
       VALUES ($1, $2, 'REQUEST_PENDING', $3, NOW(), NOW(), NOW())
       ON CONFLICT (LEAST(participant_one, participant_two), GREATEST(participant_one, participant_two))
       DO UPDATE SET 
         deleted_by = array_remove(COALESCE(conversations.deleted_by, '{}'), $3),
         updated_at = NOW()
       RETURNING *`,
      [part1, part2, cId]
    );

    const conv = insertRes.rows[0];

    // Mirror to Firestore for hybrid fallback
    try {
      await firestore.collection(COLLECTIONS.CONVERSATIONS).doc(conv.id).set({
        participants: [part1, part2],
        lastMessage: '',
        lastMessageAt: new Date(),
        lastMessageBy: cId,
        createdAt: new Date(),
      }, { merge: true });
    } catch (_) {}

    return conv;
  }

  /**
   * Sends a message idempotently, persists attachments, broadcasts once per socket, and triggers mute-aware FCM.
   */
  static async sendMessage(data: SendMessagePayload) {
    const senderId = (await this.resolveUserUuid(data.senderId)) || data.senderId;
    const recipientId = data.recipientId
      ? (await this.resolveUserUuid(data.recipientId)) || data.recipientId
      : undefined;

    const { message } = await ChatMessagingService.sendMessageIdempotent(
      {
        conversationId: data.conversationId,
        senderId,
        recipientId,
        content: data.content || '',
        messageType: data.messageType,
        mediaUrl: data.mediaUrl,
        replyToId: data.replyToId,
        clientMessageId: data.clientMessageId,
        forwardedFromMessageId: data.forwardedFromMessageId,
        metadata: data.metadata,
        attachments: data.attachments,
      },
      {
        onNewMessagePush: async (p) => {
          await this.dispatchMessageNotification(p.senderId, p.recipientId, p.conversationId, {
            id: p.messageId,
            content: p.content,
            message_type: p.messageType,
          });
        },
      }
    );

    return message;
  }

  static async forwardMessage(
    sourceMessageId: string,
    userId: string,
    params: {
      targetConversationIds?: string[];
      targetRecipientIds?: string[];
      clientMessageIdPrefix?: string;
    }
  ) {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    const resolvedRecipients = params.targetRecipientIds
      ? await Promise.all(params.targetRecipientIds.map(async (id) => (await this.resolveUserUuid(id)) || id))
      : undefined;

    return ChatMessagingService.forwardMessage(
      sourceMessageId,
      uId,
      {
        ...params,
        targetRecipientIds: resolvedRecipients,
      },
      async (p) => {
        await this.dispatchMessageNotification(p.senderId, p.recipientId, p.conversationId, {
          id: p.messageId,
          content: p.content,
          message_type: p.messageType,
        });
      }
    );
  }

  static async getAuthorizedPeerId(conversationId: string, userId: string): Promise<string | null> {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    return ChatMessagingService.getAuthorizedPeerId(conversationId, uId);
  }

  /**
   * Marks all unread messages in a conversation as read by the recipient.
   */
  static async markConversationAsRead(conversationId: string, userId: string) {
    try {
      const uId = (await this.resolveUserUuid(userId)) || userId;
      return await ChatMessagingService.markConversationAsRead(conversationId, uId);
    } catch (e: any) {
      logger.error('[ChatService.markConversationAsRead] error: ' + e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Marks a single message as read.
   */
  static async markMessageRead(conversationId: string, messageId: string, userId: string) {
    try {
      const uId = (await this.resolveUserUuid(userId)) || userId;
      const res = await query(
        `UPDATE messages
         SET is_read = TRUE,
             read_at = COALESCE(read_at, NOW()),
             is_delivered = TRUE,
             delivered_at = COALESCE(delivered_at, NOW()),
             send_status = 'seen'
         WHERE id = $1 AND receiver_id = $2
         RETURNING id, sender_id, conversation_id`,
        [messageId, uId]
      );

      if (res.rowCount && res.rowCount > 0) {
        const row = res.rows[0];
        const [viewerPrivacy, peerPrivacy] = await Promise.all([
          PresenceService.getPrivacySettings(uId),
          PresenceService.getPrivacySettings(String(row.sender_id)),
        ]);
        const io = getSocketIO();
        if (io && viewerPrivacy.readReceiptsEnabled && peerPrivacy.readReceiptsEnabled) {
          io.to(`user:${row.sender_id}`).emit('message_read', {
            conversationId: row.conversation_id,
            messageId: row.id,
            readerId: uId,
            readAt: new Date().toISOString(),
          });
        }
      }

      return { success: true };
    } catch (e: any) {
      logger.error('[ChatService.markMessageRead] error: ' + e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Marks a message as delivered upon client acknowledgement.
   */
  static async markMessageDelivered(messageId: string, userId: string) {
    try {
      const uId = (await this.resolveUserUuid(userId)) || userId;
      return await ChatMessagingService.markMessageDelivered(messageId, uId);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Deletes a message either for the calling user (`me`) or for everyone (`everyone`).
   */
  static async deleteMessage(messageId: string, userId: string, scope: 'me' | 'everyone' = 'me') {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    return ChatMessagingService.deleteMessage(messageId, uId, scope);
  }

  /**
   * Toggles an emoji reaction on a message.
   */
  static async toggleReaction(messageId: string, userId: string, emoji: string) {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    const existing = await query(
      `SELECT id, emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
      [messageId, uId]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      if (existing.rows[0].emoji === emoji) {
        await query(`DELETE FROM message_reactions WHERE id = $1`, [existing.rows[0].id]);
      } else {
        await query(`UPDATE message_reactions SET emoji = $1, created_at = NOW() WHERE id = $2`, [
          emoji,
          existing.rows[0].id,
        ]);
      }
    } else {
      await query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = $3`,
        [messageId, uId, emoji]
      );
    }

    const reactionsRes = await query(
      `SELECT jsonb_object_agg(user_id, emoji) AS reactions 
       FROM message_reactions WHERE message_id = $1`,
      [messageId]
    );
    const reactions = reactionsRes.rows[0]?.reactions || {};

    const msgRes = await query(
      `SELECT m.conversation_id, c.participant_one, c.participant_two
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1`,
      [messageId]
    );
    if (msgRes.rowCount && msgRes.rowCount > 0) {
      const { conversation_id: convId, participant_one: p1, participant_two: p2 } = msgRes.rows[0];
      const io = getSocketIO();
      if (io) {
        io.to(`user:${p1}`).to(`user:${p2}`).emit('reaction_updated', {
          messageId,
          conversationId: convId,
          reactions,
        });
      }
    }

    return { success: true, reactions };
  }

  /**
   * Blocks a user from initiating or sending messages.
   */
  static async blockUser(blockerId: string, blockedId: string, reason?: string) {
    const bId = (await this.resolveUserUuid(blockerId)) || blockerId;
    const tgtId = (await this.resolveUserUuid(blockedId)) || blockedId;

    if (bId === tgtId) throw new Error('Cannot block yourself');

    await query(
      `INSERT INTO blocked_users (blocker_id, blocked_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [bId, tgtId, reason || 'User requested block']
    );

    // Also update existing conversation state to BLOCKED if present
    await query(
      `UPDATE conversations 
       SET status = 'BLOCKED', updated_at = NOW()
       WHERE (participant_one = $1 AND participant_two = $2)
          OR (participant_one = $2 AND participant_two = $1)`,
      [bId, tgtId]
    ).catch(() => {});

    return { success: true, message: 'User blocked successfully' };
  }

  /**
   * Unblocks a user.
   */
  static async unblockUser(blockerId: string, blockedId: string) {
    const bId = (await this.resolveUserUuid(blockerId)) || blockerId;
    const tgtId = (await this.resolveUserUuid(blockedId)) || blockedId;

    await query(
      `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
      [bId, tgtId]
    );

    return { success: true, message: 'User unblocked successfully' };
  }

  /**
   * Submits a message moderation report.
   */
  static async reportMessage(messageId: string, reporterId: string, reason: string) {
    const rId = (await this.resolveUserUuid(reporterId)) || reporterId;
    await query(
      `INSERT INTO reported_messages (message_id, reporter_id, reason)
       VALUES ($1, $2, $3)`,
      [messageId, rId, reason]
    );

    return { success: true, message: 'Message reported successfully' };
  }

  /**
   * Returns total unread message count for a user across all conversations.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const uId = (await this.resolveUserUuid(userId)) || userId;
      const res = await query(
        `SELECT COUNT(*) as count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
         WHERE m.receiver_id = $1
           AND COALESCE(m.is_read, FALSE) = FALSE
           AND m.read_at IS NULL
           AND COALESCE(m.deleted_for_everyone, m.is_deleted, FALSE) = FALSE
           AND NOT ($1 = ANY(COALESCE(c.deleted_by, '{}')))
           AND COALESCE(cp.is_deleted, FALSE) = FALSE
           AND (cp.cleared_before_at IS NULL OR m.created_at > cp.cleared_before_at)
           AND NOT EXISTS (
             SELECT 1 FROM message_user_visibility muv
             WHERE muv.message_id = m.id AND muv.user_id = $1
           )`,
        [uId]
      );
      return parseInt(res.rows[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Searches users and organizations to initiate new conversations.
   */
  static async searchUsers(currentUserId: string, searchTerm: string) {
    const uId = (await this.resolveUserUuid(currentUserId)) || currentUserId;
    const term = `%${(searchTerm || '').trim()}%`;
    const res = await query(
      `SELECT 
         u.id, 
         u.full_name, 
         COALESCE(u.username, SPLIT_PART(u.email, '@', 1)) AS username, 
         u.avatar_url, 
         u.role,
         COALESCE(u.is_verified, FALSE) AS user_verified,
         up.bio,
         org.name as org_name,
         org.logo_url as org_logo,
         COALESCE(org.is_verified, FALSE) AS org_verified
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN organizations org ON org.owner_id = u.id
       WHERE u.id != $1
         AND u.is_banned = FALSE
         AND (
           u.full_name ILIKE $2 
           OR u.username ILIKE $2 
           OR u.email ILIKE $2
           OR org.name ILIKE $2
         )
       LIMIT 25`,
      [uId, term]
    );

    const peerIds = res.rows.map((r) => String(r.id));
    const presenceMap = await PresenceService.getPresenceForUsers(uId, peerIds);

    return res.rows.map((row) => {
      const p = presenceMap[String(row.id)];
      const isVerified = Boolean(row.org_verified || row.user_verified);
      return {
        id: row.id,
        name: row.org_name || row.full_name || 'User',
        username: row.username || 'user',
        photoUrl: row.org_logo || row.avatar_url || '',
        avatar_url: row.org_logo || row.avatar_url || '',
        bio: row.bio || 'KnotNex Community Member',
        role: row.role || 'user',
        isOrganization: !!row.org_name || row.role === 'org',
        is_online: p?.isOnline ?? false,
        isOnline: p?.isOnline ?? false,
        last_seen_at: p?.lastSeenAt ?? null,
        lastSeenAt: p?.lastSeenAt ?? null,
        is_verified: isVerified,
        isVerified,
      };
    });
  }

  /**
   * Dispatches push notification and in-app alert via centralized NotificationService.
   */
  private static async dispatchMessageNotification(
    senderId: string,
    recipientId: string,
    conversationId: string,
    message: any
  ) {
    try {
      const senderRes = await query(
        `SELECT u.full_name, u.avatar_url, org.name as org_name, org.logo_url as org_logo 
         FROM users u 
         LEFT JOIN organizations org ON org.owner_id = u.id 
         WHERE u.id = $1 LIMIT 1`,
        [senderId]
      );

      const senderName = senderRes.rows[0]?.org_name || senderRes.rows[0]?.full_name || 'Someone';
      const senderAvatar = senderRes.rows[0]?.org_logo || senderRes.rows[0]?.avatar_url || '';

      const preview = message.content
        ? (message.content.length > 60 ? message.content.substring(0, 57) + '...' : message.content)
        : (message.message_type ? `Sent you a ${message.message_type}` : 'Sent an attachment');

      await NotificationService.createNotification(
        recipientId,
        senderId,
        'chat',
        senderName,
        preview,
        {
          conversationId,
          messageId: message.id,
          senderName,
          senderAvatar,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          route: '/chat-detail',
        }
      );
    } catch (e: any) {
      logger.warn('[ChatService.dispatchMessageNotification] Error: ' + e.message);
    }
  }

  /**
   * Accepts a stranger message request, converting it to an active conversation.
   */
  static async acceptRequest(conversationId: string, userId: string) {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    const targetOtherUserId = (await this.resolveUserUuid(conversationId)) || conversationId;

    const res = await query(
      `UPDATE conversations 
       SET status = 'ACCEPTED', updated_at = NOW() 
       WHERE (id::text = $1 OR ((participant_one = $2 AND participant_two::text = $3) OR (participant_one::text = $3 AND participant_two = $2)))
         AND (participant_one = $2 OR participant_two = $2)
       RETURNING *`,
      [conversationId, uId, targetOtherUserId]
    );
    if (!res.rowCount || res.rowCount === 0) {
      throw new Error('Conversation not found');
    }
    const conv = res.rows[0];
    const otherUserId = conv.participant_one === uId ? conv.participant_two : conv.participant_one;
    const io = getSocketIO();
    if (io) {
      io.to(`user:${otherUserId}`).to(`user:${uId}`).emit('request_accepted', { conversationId: conv.id });
    }
    return conv;
  }

  /**
   * Rejects a stranger message request.
   */
  static async rejectRequest(conversationId: string, userId: string) {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    const targetOtherUserId = (await this.resolveUserUuid(conversationId)) || conversationId;

    const res = await query(
      `UPDATE conversations 
       SET status = 'REJECTED', updated_at = NOW() 
       WHERE (id::text = $1 OR ((participant_one = $2 AND participant_two::text = $3) OR (participant_one::text = $3 AND participant_two = $2)))
         AND (participant_one = $2 OR participant_two = $2)
       RETURNING *`,
      [conversationId, uId, targetOtherUserId]
    );
    if (!res.rowCount || res.rowCount === 0) {
      throw new Error('Conversation not found');
    }
    const conv = res.rows[0];
    const otherUserId = conv.participant_one === uId ? conv.participant_two : conv.participant_one;
    const io = getSocketIO();
    if (io) {
      io.to(`user:${otherUserId}`).to(`user:${uId}`).emit('request_rejected', { conversationId: conv.id });
    }
    return conv;
  }

  /**
   * Toggles pin status for a conversation for the calling user.
   */
  static async togglePin(conversationId: string, userId: string) {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    const check = await query(`SELECT pinned_by FROM conversations WHERE id = $1`, [conversationId]);
    const isPinned = (check.rows[0]?.pinned_by || []).includes(uId);
    const sql = isPinned
      ? `UPDATE conversations SET pinned_by = array_remove(pinned_by, $1), updated_at = NOW() WHERE id = $2 RETURNING *`
      : `UPDATE conversations SET pinned_by = array_append(pinned_by, $1), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const res = await query(sql, [uId, conversationId]);
    return { isPinned: !isPinned, conversation: res.rows[0] };
  }

  /**
   * Toggles archive status for a conversation for the calling user.
   */
  static async toggleArchive(conversationId: string, userId: string) {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    const check = await query(`SELECT archived_by FROM conversations WHERE id = $1`, [conversationId]);
    const isArchived = (check.rows[0]?.archived_by || []).includes(uId);
    const sql = isArchived
      ? `UPDATE conversations SET archived_by = array_remove(archived_by, $1), updated_at = NOW() WHERE id = $2 RETURNING *`
      : `UPDATE conversations SET archived_by = array_append(archived_by, $1), updated_at = NOW() WHERE id = $2 RETURNING *`;
    const res = await query(sql, [uId, conversationId]);
    return { isArchived: !isArchived, conversation: res.rows[0] };
  }

  /**
   * Deletes a conversation from the calling user's inbox (soft delete per user).
   */
  static async deleteConversationForUser(conversationId: string, userId: string) {
    const uId = (await this.resolveUserUuid(userId)) || userId;
    await query(
      `UPDATE conversations 
       SET deleted_by = array_append(array_remove(COALESCE(deleted_by, '{}'), $1), $1), updated_at = NOW() 
       WHERE id = $2`,
      [uId, conversationId]
    );
    await query(
      `INSERT INTO conversation_participants (conversation_id, user_id, is_deleted, unread_count, updated_at)
       VALUES ($1, $2, TRUE, 0, NOW())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET
         is_deleted = TRUE,
         unread_count = 0,
         updated_at = NOW()`,
      [conversationId, uId]
    );
    return { success: true };
  }

  /**
   * Retrieves randomized eligible users for discovery when inbox is empty or exploring.
   */
  static async discoverUsers(currentUserId: string, limit: number = 20) {
    try {
      const uId = (await this.resolveUserUuid(currentUserId)) || currentUserId;
      const res = await query(
        `SELECT 
            u.id, 
            u.full_name AS name, 
            COALESCE(u.username, SPLIT_PART(u.email, '@', 1)) AS username, 
            u.email, 
            u.avatar_url, 
            u.role,
            COALESCE(u.is_verified, FALSE) AS user_verified,
            up.bio,
            org.name AS org_name,
            org.logo_url AS org_logo,
            COALESCE(org.is_verified, FALSE) AS org_verified
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id
         LEFT JOIN organizations org ON org.owner_id = u.id
         WHERE u.id <> $1
           AND u.is_banned = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM blocked_users bu 
             WHERE (bu.blocker_id = $1 AND bu.blocked_id = u.id)
                OR (bu.blocker_id = u.id AND bu.blocked_id = $1)
           )
         ORDER BY RANDOM()
         LIMIT $2`,
        [uId, limit]
      );

      const peerIds = res.rows.map((r) => String(r.id));
      const presenceMap = await PresenceService.getPresenceForUsers(uId, peerIds);

      return res.rows.map((row) => {
        const p = presenceMap[String(row.id)];
        const isVerified = Boolean(row.org_verified || row.user_verified);
        return {
          id: row.id,
          name: row.org_name || row.name || 'KnotNex Member',
          username: row.username || 'user',
          email: row.email || '',
          photoUrl: row.org_logo || row.avatar_url || '',
          avatar_url: row.org_logo || row.avatar_url || '',
          bio: row.bio || 'KnotNex Community Member',
          role: row.role || 'User',
          is_online: p?.isOnline ?? false,
          isOnline: p?.isOnline ?? false,
          last_seen_at: p?.lastSeenAt ?? null,
          lastSeenAt: p?.lastSeenAt ?? null,
          is_verified: isVerified,
          isVerified,
        };
      });
    } catch (e: any) {
      logger.warn('[ChatService.discoverUsers] Error: ' + e.message);
      return [];
    }
  }

  // ─── Legacy Firestore Fallback Helpers ─────────────────────────────────────
  private static async listFirestoreConversations(userId: string) {
    try {
      const snapshot = await firestore
        .collection(COLLECTIONS.CONVERSATIONS)
        .where('participants', 'array-contains', userId)
        .orderBy('lastMessageAt', 'desc')
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch {
      return [];
    }
  }

  private static async getFirestoreConversationMessages(conversationId: string, limit: number) {
    try {
      const snapshot = await firestore
        .collection(COLLECTIONS.CONVERSATIONS)
        .doc(conversationId)
        .collection(COLLECTIONS.MESSAGES)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
    } catch {
      return [];
    }
  }
}
