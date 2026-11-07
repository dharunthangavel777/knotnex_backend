import { query } from '../config/database';
import { logger } from '../config/logger';
import { getSocketIO } from '../websockets/socket.server';
import { NotificationService } from './notification.service';
import { firestore } from '../config/firebase';
import { COLLECTIONS } from '../config/firestore';

export interface SendMessagePayload {
  conversationId?: string;
  senderId: string;
  recipientId?: string;
  content: string;
  messageType?: string;
  mediaUrl?: string;
  replyToId?: string;
  metadata?: any;
}

export class ChatService {
  /**
   * Validates if a user is an authorized participant in a conversation.
   */
  static async verifyParticipant(conversationId: string, userId: string): Promise<boolean> {
    try {
      const res = await query(
        `SELECT 1 FROM conversations 
         WHERE id = $1 AND (participant_one = $2 OR participant_two = $2)
         LIMIT 1`,
        [conversationId, userId]
      );
      if (res.rowCount && res.rowCount > 0) return true;

      // Fallback check against Firestore if table is empty or legacy doc
      try {
        const doc = await firestore.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).get();
        if (doc.exists) {
          const parts = (doc.data()?.participants as string[]) || [];
          return parts.includes(userId);
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
  static async listUserConversations(userId: string) {
    try {
      const res = await query(
        `SELECT 
            c.id,
            c.participant_one,
            c.participant_two,
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
            u.username AS other_user_username,
            u.avatar_url AS other_user_avatar,
            u.role AS other_user_role,
            org.name AS other_org_name,
            org.logo_url AS other_org_logo
         FROM conversations c
         JOIN users u ON u.id = (
           CASE WHEN c.participant_one = $1 THEN c.participant_two ELSE c.participant_one END
         )
         LEFT JOIN organizations org ON org.owner_id = u.id
         WHERE (c.participant_one = $1 OR c.participant_two = $1)
         ORDER BY c.last_message_at DESC NULLS LAST`,
        [userId]
      );

      if (res.rows && res.rows.length > 0) {
        return res.rows.map((row) => {
          const displayName = row.other_org_name || row.other_user_name || 'User';
          const avatarUrl = row.other_org_logo || row.other_user_avatar || '';
          const otherUser = {
            id: row.other_user_id,
            name: displayName,
            username: row.other_user_username || 'user',
            email: `${row.other_user_username || 'user'}@knotnex.com`,
            avatar_url: avatarUrl,
            photoUrl: avatarUrl,
            role: row.other_user_role,
            is_online: true,
            is_verified: true,
          };

          return {
            id: row.id,
            participants: [row.participant_one, row.participant_two],
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
      }

      // Legacy fallback to Firestore if SQL returns no rows
      return this.listFirestoreConversations(userId);
    } catch (err: any) {
      logger.error('[ChatService.listUserConversations] SQL error, attempting Firestore fallback: ' + err.message);
      return this.listFirestoreConversations(userId);
    }
  }

  /**
   * Retrieves messages for a conversation or target user.
   */
  static async getConversationOrDirectMessages(
    currentUserId: string,
    targetId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    try {
      // 1. Check if targetId is a conversation ID
      let conversationId = targetId;
      const convCheck = await query(
        `SELECT id, participant_one, participant_two 
         FROM conversations 
         WHERE id = $1 AND (participant_one = $2 OR participant_two = $2)
         LIMIT 1`,
        [targetId, currentUserId]
      );

      if (convCheck.rowCount === 0) {
        // targetId is a user UUID — find or start the direct conversation
        const conv = await this.startConversation(currentUserId, targetId);
        conversationId = conv.id;
      }

      // 2. Fetch messages from PostgreSQL
      const msgRes = await query(
        `SELECT 
            m.id,
            m.conversation_id,
            m.sender_id,
            m.receiver_id,
            m.content,
            m.message_type,
            m.media_url,
            m.is_read,
            m.read_at,
            m.is_delivered,
            m.delivered_at,
            m.is_deleted,
            m.reply_to_id,
            m.metadata,
            m.created_at,
            r.content AS reply_to_content,
            ru.full_name AS reply_to_sender_name,
            COALESCE(
              (
                SELECT jsonb_object_agg(mr.user_id, mr.emoji)
                FROM message_reactions mr
                WHERE mr.message_id = m.id
              ),
              '{}'::jsonb
            ) AS reactions
         FROM messages m
         LEFT JOIN messages r ON r.id = m.reply_to_id
         LEFT JOIN users ru ON ru.id = r.sender_id
         WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
         ORDER BY m.created_at ASC
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return msgRes.rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        content: row.content,
        messageType: row.message_type || 'text',
        mediaUrl: row.media_url,
        isRead: row.is_read,
        readAt: row.read_at,
        isDelivered: row.is_delivered,
        deliveredAt: row.delivered_at,
        replyToId: row.reply_to_id,
        replyToContent: row.reply_to_content,
        replyToSenderName: row.reply_to_sender_name,
        reactions: row.reactions || {},
        metadata: row.metadata || {},
        timestamp: row.created_at,
        created_at: row.created_at,
      }));
    } catch (err: any) {
      logger.error('[ChatService.getConversationOrDirectMessages] SQL error, attempting Firestore fallback: ' + err.message);
      return this.getFirestoreConversationMessages(targetId, limit);
    }
  }

  /**
   * Starts or retrieves a 1-on-1 conversation between two accounts.
   */
  static async startConversation(creatorId: string, participantId: string) {
    if (creatorId === participantId) {
      throw new Error('Cannot start conversation with yourself');
    }

    // Check if communication is blocked
    const blockCheck = await query(
      `SELECT 1 FROM blocked_users 
       WHERE (blocker_id = $1 AND blocked_id = $2) 
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [creatorId, participantId]
    );

    if (blockCheck.rowCount && blockCheck.rowCount > 0) {
      throw new Error('Communication is blocked between these accounts');
    }

    // Find or create pairwise conversation
    const p1 = creatorId < participantId ? creatorId : participantId;
    const p2 = creatorId < participantId ? participantId : creatorId;

    const findRes = await query(
      `SELECT * FROM conversations 
       WHERE participant_one = $1 AND participant_two = $2 
       LIMIT 1`,
      [p1, p2]
    );

    if (findRes.rowCount && findRes.rowCount > 0) {
      return findRes.rows[0];
    }

    const insertRes = await query(
      `INSERT INTO conversations (participant_one, participant_two, last_message_at, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW(), NOW())
       ON CONFLICT (LEAST(participant_one, participant_two), GREATEST(participant_one, participant_two))
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [p1, p2]
    );

    const conv = insertRes.rows[0];

    // Mirror to Firestore for hybrid fallback
    try {
      await firestore.collection(COLLECTIONS.CONVERSATIONS).doc(conv.id).set({
        participants: [p1, p2],
        lastMessage: '',
        lastMessageAt: new Date(),
        lastMessageBy: creatorId,
        createdAt: new Date(),
      }, { merge: true });
    } catch (_) {}

    return conv;
  }

  /**
   * Sends a message, persists to PostgreSQL Cloud SQL, broadcasts via Socket.IO, and triggers FCM.
   */
  static async sendMessage(data: SendMessagePayload) {
    let conversationId = data.conversationId;
    let recipientId = data.recipientId;

    // 1. Resolve or create conversation
    if (!conversationId && recipientId) {
      const conv = await this.startConversation(data.senderId, recipientId);
      conversationId = conv.id;
    } else if (conversationId && !recipientId) {
      const convRes = await query(
        `SELECT participant_one, participant_two FROM conversations WHERE id = $1 LIMIT 1`,
        [conversationId]
      );
      if (convRes.rowCount && convRes.rowCount > 0) {
        const row = convRes.rows[0];
        recipientId = row.participant_one === data.senderId ? row.participant_two : row.participant_one;
      }
    }

    if (!conversationId || !recipientId) {
      throw new Error('Valid conversationId and recipientId are required');
    }

    // 2. Enforce block check
    const blockCheck = await query(
      `SELECT 1 FROM blocked_users 
       WHERE (blocker_id = $1 AND blocked_id = $2) 
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [data.senderId, recipientId]
    );

    if (blockCheck.rowCount && blockCheck.rowCount > 0) {
      throw new Error('Cannot send message: User communication is restricted');
    }

    // 3. Persist to PostgreSQL messages table
    const msgRes = await query(
      `INSERT INTO messages (
          conversation_id, sender_id, receiver_id, content, 
          message_type, media_url, reply_to_id, metadata, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        conversationId,
        data.senderId,
        recipientId,
        data.content || '',
        data.messageType || 'text',
        data.mediaUrl || null,
        data.replyToId || null,
        JSON.stringify(data.metadata || {}),
      ]
    );

    const savedMessage = msgRes.rows[0];

    // 4. Update conversation metadata and unread counter
    await query(
      `UPDATE conversations
       SET last_message = $1,
           last_message_at = NOW(),
           last_message_by = $2,
           unread_count_one = CASE WHEN participant_one = $3 THEN unread_count_one + 1 ELSE unread_count_one END,
           unread_count_two = CASE WHEN participant_two = $3 THEN unread_count_two + 1 ELSE unread_count_two END,
           updated_at = NOW()
       WHERE id = $4`,
      [
        data.content || (data.messageType ? `[${data.messageType}]` : 'Attachment'),
        data.senderId,
        recipientId,
        conversationId,
      ]
    );

    // 5. Construct client payload
    const messagePayload = {
      id: savedMessage.id,
      conversationId: conversationId,
      senderId: data.senderId,
      receiverId: recipientId,
      content: savedMessage.content,
      messageType: savedMessage.message_type,
      mediaUrl: savedMessage.media_url,
      replyToId: savedMessage.reply_to_id,
      isRead: false,
      isDelivered: false,
      reactions: {},
      metadata: savedMessage.metadata || {},
      timestamp: savedMessage.created_at,
      created_at: savedMessage.created_at,
    };

    // 6. Real-time broadcast via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`conversation_${conversationId}`).emit('new_message', messagePayload);
      io.to(`user:${recipientId}`).emit('new_message', messagePayload);
      io.to(`user:${recipientId}`).emit('conversation_updated', {
        conversationId,
        lastMessage: messagePayload.content,
        lastMessageAt: messagePayload.timestamp,
        senderId: data.senderId,
      });
      io.to(`user:${data.senderId}`).emit('conversation_updated', {
        conversationId,
        lastMessage: messagePayload.content,
        lastMessageAt: messagePayload.timestamp,
        senderId: data.senderId,
      });
    }

    // 7. Centralized Push Notification & FCM dispatch
    this.dispatchMessageNotification(data.senderId, recipientId, conversationId, savedMessage).catch((e) => {
      logger.warn('[ChatService.sendMessage] Push notification dispatch notice: ' + e.message);
    });

    return messagePayload;
  }

  /**
   * Marks all unread messages in a conversation as read by the recipient.
   */
  static async markConversationAsRead(conversationId: string, userId: string) {
    try {
      const updateRes = await query(
        `UPDATE messages 
         SET is_read = TRUE, read_at = NOW(), is_delivered = TRUE, delivered_at = COALESCE(delivered_at, NOW())
         WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = FALSE
         RETURNING id, sender_id`,
        [conversationId, userId]
      );

      await query(
        `UPDATE conversations
         SET unread_count_one = CASE WHEN participant_one = $1 THEN 0 ELSE unread_count_one END,
             unread_count_two = CASE WHEN participant_two = $1 THEN 0 ELSE unread_count_two END,
             updated_at = NOW()
         WHERE id = $2`,
        [userId, conversationId]
      );

      // Real-time broadcast
      const io = getSocketIO();
      if (io && updateRes.rowCount && updateRes.rowCount > 0) {
        const senderId = updateRes.rows[0]?.sender_id;
        io.to(`conversation_${conversationId}`).emit('message_read', {
          conversationId,
          readerId: userId,
          readAt: new Date(),
        });
        if (senderId) {
          io.to(`user:${senderId}`).emit('message_read', {
            conversationId,
            readerId: userId,
            readAt: new Date(),
          });
        }
      }

      return { success: true, count: updateRes.rowCount };
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
      const res = await query(
        `UPDATE messages 
         SET is_read = TRUE, read_at = NOW(), is_delivered = TRUE, delivered_at = COALESCE(delivered_at, NOW())
         WHERE id = $1 AND receiver_id = $2
         RETURNING id, sender_id, conversation_id`,
        [messageId, userId]
      );

      if (res.rowCount && res.rowCount > 0) {
        const row = res.rows[0];
        const io = getSocketIO();
        if (io) {
          io.to(`conversation_${row.conversation_id}`).emit('message_read', {
            conversationId: row.conversation_id,
            messageId: row.id,
            readerId: userId,
            readAt: new Date(),
          });
          io.to(`user:${row.sender_id}`).emit('message_read', {
            conversationId: row.conversation_id,
            messageId: row.id,
            readerId: userId,
            readAt: new Date(),
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
      const res = await query(
        `UPDATE messages
         SET is_delivered = TRUE, delivered_at = NOW()
         WHERE id = $1 AND receiver_id = $2 AND is_delivered = FALSE
         RETURNING id, sender_id, conversation_id`,
        [messageId, userId]
      );

      if (res.rowCount && res.rowCount > 0) {
        const row = res.rows[0];
        const io = getSocketIO();
        if (io) {
          io.to(`user:${row.sender_id}`).emit('message_delivered', {
            messageId: row.id,
            conversationId: row.conversation_id,
            deliveredAt: new Date(),
          });
        }
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Soft-deletes a message (Unsend).
   */
  static async deleteMessage(messageId: string, userId: string) {
    const res = await query(
      `UPDATE messages
       SET is_deleted = TRUE, deleted_at = NOW(), content = 'This message was deleted'
       WHERE id = $1 AND sender_id = $2
       RETURNING id, conversation_id, receiver_id`,
      [messageId, userId]
    );

    if (res.rowCount === 0) {
      throw new Error('Message not found or unauthorized to delete');
    }

    const row = res.rows[0];
    const io = getSocketIO();
    if (io) {
      io.to(`conversation_${row.conversation_id}`).emit('message_deleted', {
        messageId: row.id,
        conversationId: row.conversation_id,
      });
      io.to(`user:${row.receiver_id}`).emit('message_deleted', {
        messageId: row.id,
        conversationId: row.conversation_id,
      });
    }

    return { success: true, messageId: row.id };
  }

  /**
   * Toggles an emoji reaction on a message.
   */
  static async toggleReaction(messageId: string, userId: string, emoji: string) {
    // 1. Check if reaction exists
    const existing = await query(
      `SELECT id, emoji FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId]
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
        [messageId, userId, emoji]
      );
    }

    // 2. Fetch updated reactions map
    const reactionsRes = await query(
      `SELECT jsonb_object_agg(user_id, emoji) AS reactions 
       FROM message_reactions WHERE message_id = $1`,
      [messageId]
    );
    const reactions = reactionsRes.rows[0]?.reactions || {};

    // 3. Broadcast to conversation room
    const msgRes = await query(`SELECT conversation_id FROM messages WHERE id = $1`, [messageId]);
    if (msgRes.rowCount && msgRes.rowCount > 0) {
      const convId = msgRes.rows[0].conversation_id;
      const io = getSocketIO();
      if (io) {
        io.to(`conversation_${convId}`).emit('reaction_updated', {
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
    if (blockerId === blockedId) throw new Error('Cannot block yourself');

    await query(
      `INSERT INTO blocked_users (blocker_id, blocked_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId, reason || 'User requested block']
    );

    return { success: true, message: 'User blocked successfully' };
  }

  /**
   * Unblocks a user.
   */
  static async unblockUser(blockerId: string, blockedId: string) {
    await query(
      `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );

    return { success: true, message: 'User unblocked successfully' };
  }

  /**
   * Submits a message moderation report.
   */
  static async reportMessage(messageId: string, reporterId: string, reason: string) {
    await query(
      `INSERT INTO reported_messages (message_id, reporter_id, reason)
       VALUES ($1, $2, $3)`,
      [messageId, reporterId, reason]
    );

    return { success: true, message: 'Message reported successfully' };
  }

  /**
   * Returns total unread message count for a user across all conversations.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const res = await query(
        `SELECT COUNT(*) as count 
         FROM messages 
         WHERE receiver_id = $1 AND is_read = FALSE AND is_deleted = FALSE`,
        [userId]
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
    const term = `%${(searchTerm || '').trim()}%`;
    const res = await query(
      `SELECT 
         u.id, 
         u.full_name, 
         u.username, 
         u.avatar_url, 
         u.role,
         org.name as org_name,
         org.logo_url as org_logo
       FROM users u
       LEFT JOIN organizations org ON org.owner_id = u.id
       WHERE u.id != $1
         AND (
           u.full_name ILIKE $2 
           OR u.username ILIKE $2 
           OR org.name ILIKE $2
         )
       LIMIT 25`,
      [currentUserId, term]
    );

    return res.rows.map((row) => ({
      id: row.id,
      name: row.org_name || row.full_name || 'User',
      username: row.username || 'user',
      photoUrl: row.org_logo || row.avatar_url || '',
      avatar_url: row.org_logo || row.avatar_url || '',
      role: row.role || 'user',
      isOrganization: !!row.org_name || row.role === 'org',
      is_online: true,
    }));
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
      // 1. Fetch sender display name
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

      // 2. Dispatch via centralized NotificationService
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
