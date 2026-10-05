import { firestore } from '../config/firebase';
import { COLLECTIONS } from '../config/firestore';
import { MessageType } from '../types/enums';
import { NotificationService } from './notification.service';

export class ChatService {
  static async listUserConversations(userId: string) {
    const snapshot = await firestore
      .collection(COLLECTIONS.CONVERSATIONS)
      .where('participants', 'array-contains', userId)
      .orderBy('lastMessageAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  static async getConversationMessages(conversationId: string, limit: number = 50) {
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

    // Send notification to other participant
    convRef.get().then(doc => {
      if (doc.exists) {
        const parts = (doc.data()?.participants as string[]) || [];
        const recipientId = parts.find(p => p !== data.senderId);
        if (recipientId) {
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

    return { id: msgRef.id, ...messageData };
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
