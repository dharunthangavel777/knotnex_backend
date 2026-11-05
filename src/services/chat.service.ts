import { firestore } from '../config/firebase';
import { COLLECTIONS } from '../config/firestore';
import { MessageType } from '../types/enums';
import { NotificationService } from './notification.service';
import { query } from '../config/database';
import { logger } from '../config/logger';
import { getSocketIO } from '../websockets/socket.server';

export class ChatService {
  static async listUserConversations(userId: string) {
    try {
      const snapshot = await firestore
        .collection(COLLECTIONS.CONVERSATIONS)
        .where('participants', 'array-contains', userId)
        .orderBy('lastMessageAt', 'desc')
        .get();

      const rawList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Collect other participant IDs
      const otherUserIds = Array.from(new Set(
        rawList.map((c: any) => {
          const parts = (c.participants || []) as string[];
          return parts.find((p) => p !== userId);
        }).filter(Boolean) as string[]
      ));

      const userMap = new Map<string, any>();
      if (otherUserIds.length > 0) {
        try {
          const userRes = await query(
            `SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, u.username,
                    org.name as registered_org_name, org.logo_url as organization_logo
             FROM users u
             LEFT JOIN organizations org ON org.owner_id = u.id
             WHERE u.id = ANY($1)`,
            [otherUserIds]
          );
          for (const row of userRes.rows) {
            userMap.set(row.id, {
              id: row.id,
              name: row.registered_org_name || row.full_name || 'User',
              email: row.email,
              avatar_url: row.organization_logo || row.avatar_url || '',
              role: row.role,
              username: row.username,
              is_online: true,
              is_verified: true,
            });
          }
        } catch (e: any) {
          logger.warn('[ChatService.listUserConversations] user enrichment warning: ' + e.message);
        }
      }

      return rawList.map((conv: any) => {
        const parts = (conv.participants || []) as string[];
        const otherId = parts.find((p) => p !== userId) || '';
        const otherUser = userMap.get(otherId) || {
          id: otherId,
          name: 'User',
          email: '',
          avatar_url: '',
          role: 'user',
          is_online: false,
          is_verified: true,
        };
        return {
          ...conv,
          other_user: otherUser,
          participant: otherUser,
        };
      });
    } catch (err: any) {
      logger.error('[ChatService.listUserConversations] error: ' + err.message);
      return [];
    }
  }

  static async getConversationMessages(conversationId: string, limit: number = 50) {
    try {
      const snapshot = await firestore
        .collection(COLLECTIONS.CONVERSATIONS)
        .doc(conversationId)
        .collection(COLLECTIONS.MESSAGES)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })).reverse();
    } catch (err: any) {
      logger.error('[ChatService.getConversationMessages] error: ' + err.message);
      return [];
    }
  }

  static async getConversationOrDirectMessages(currentUserId: string, targetId: string, limit: number = 50) {
    try {
      // 1. Try treating targetId as a direct conversation ID
      const directDoc = await firestore.collection(COLLECTIONS.CONVERSATIONS).doc(targetId).get();
      if (directDoc.exists) {
        return this.getConversationMessages(targetId, limit);
      }

      // 2. Treat targetId as the other participant's user ID
      const conv = await this.startConversation(currentUserId, targetId);
      return this.getConversationMessages(conv.id, limit);
    } catch (err: any) {
      logger.error('[ChatService.getConversationOrDirectMessages] error: ' + err.message);
      return [];
    }
  }

  static async startConversation(creatorId: string, participantId: string) {
    // Check if a direct conversation already exists
    const existing = await firestore
      .collection(COLLECTIONS.CONVERSATIONS)
      .where('participants', 'array-contains', creatorId)
      .get();

    const found = existing.docs.find((doc) => {
      const parts = doc.data().participants as string[];
      return parts.includes(participantId);
    });

    if (found) {
      return { id: found.id, ...found.data() };
    }

    const newDocRef = firestore.collection(COLLECTIONS.CONVERSATIONS).doc();
    const newConv = {
      participants: [creatorId, participantId],
      lastMessage: '',
      lastMessageAt: new Date(),
      lastMessageBy: creatorId,
      unreadCount: {
        [creatorId]: 0,
        [participantId]: 0,
      },
      createdAt: new Date(),
    };

    await newDocRef.set(newConv);
    return { id: newDocRef.id, ...newConv };
  }

  static async sendMessage(data: {
    conversationId: string;
    senderId: string;
    recipientId?: string;
    content: string;
    messageType?: MessageType;
    mediaUrl?: string;
    replyTo?: any;
    metadata?: any;
  }) {
    const convRef = firestore.collection(COLLECTIONS.CONVERSATIONS).doc(data.conversationId);
    const msgRef = convRef.collection(COLLECTIONS.MESSAGES).doc();

    const messageData = {
      senderId: data.senderId,
      receiverId: data.recipientId || null,
      content: data.content,
      messageType: data.messageType || MessageType.TEXT,
      mediaUrl: data.mediaUrl || null,
      replyTo: data.replyTo || null,
      metadata: data.metadata || {},
      isRead: false,
      timestamp: new Date(),
    };

    await msgRef.set(messageData);

    // Update conversation last message
    await convRef.set({
      lastMessage: data.content || (data.messageType ? `[${data.messageType}]` : 'Media'),
      lastMessageAt: new Date(),
      lastMessageBy: data.senderId,
    }, { merge: true });

    const messagePayload = { id: msgRef.id, conversationId: data.conversationId, ...messageData };

    // Real-time broadcast via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`conversation_${data.conversationId}`).emit('new_message', messagePayload);
      if (data.recipientId) {
        io.to(`user:${data.recipientId}`).emit('new_message', messagePayload);
      }
    }

    // Send push notification to other participant
    convRef.get().then(doc => {
      if (doc.exists) {
        const parts = (doc.data()?.participants as string[]) || [];
        const recipientId = data.recipientId || parts.find(p => p !== data.senderId);
        if (recipientId) {
          if (io && !data.recipientId) {
            io.to(`user:${recipientId}`).emit('new_message', messagePayload);
          }
          NotificationService.createNotification(
            recipientId,
            data.senderId,
            'chat',
            'New Message',
            data.content ? (data.content.length > 50 ? data.content.substring(0, 47) + '...' : data.content) : 'Sent you a message',
            { conversationId: data.conversationId, messageId: msgRef.id }
          ).catch(() => {});
        }
      }
    }).catch(() => {});

    return messagePayload;
  }

  static async markMessageRead(conversationId: string, messageId: string) {
    await firestore
      .collection(COLLECTIONS.CONVERSATIONS)
      .doc(conversationId)
      .collection(COLLECTIONS.MESSAGES)
      .doc(messageId)
      .update({ isRead: true });

    return { success: true };
  }
}
