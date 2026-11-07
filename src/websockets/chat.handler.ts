import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chat.service';
import { FirestoreIntegration } from '../integrations/firebase/firestore.firebase';
import { logger } from '../config/logger';

export const registerChatHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  socket.on('join_conversation', async (conversationId: string) => {
    if (userId) {
      const isParticipant = await ChatService.verifyParticipant(conversationId, userId);
      if (!isParticipant) {
        socket.emit('chat_error', { message: 'Unauthorized conversation access' });
        return;
      }
    }
    socket.join(`conversation_${conversationId}`);
    logger.debug(`User ${userId} joined room conversation_${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(`conversation_${conversationId}`);
    logger.debug(`User ${userId} left room conversation_${conversationId}`);
  });

  socket.on('send_message', async (data: {
    conversationId?: string;
    receiverId?: string;
    recipientId?: string;
    content: string;
    messageType?: any;
    mediaUrl?: string;
    replyToId?: any;
    replyTo?: any;
    metadata?: any;
  }) => {
    try {
      if (!userId) {
        socket.emit('chat_error', { message: 'Authentication required' });
        return;
      }

      await ChatService.sendMessage({
        conversationId: data.conversationId,
        senderId: userId,
        recipientId: data.receiverId || data.recipientId,
        content: data.content,
        messageType: data.messageType,
        mediaUrl: data.mediaUrl,
        replyToId: data.replyToId || data.replyTo,
        metadata: data.metadata,
      });
      // Broadcast is handled centrally within ChatService.sendMessage to avoid duplicates
    } catch (error: any) {
      socket.emit('chat_error', { message: error.message });
    }
  });

  socket.on('message_read', async (data: { conversationId: string; messageId?: string }) => {
    try {
      if (!userId || !data.conversationId) return;
      if (data.messageId) {
        await ChatService.markMessageRead(data.conversationId, data.messageId, userId);
      } else {
        await ChatService.markConversationAsRead(data.conversationId, userId);
      }
    } catch (e: any) {
      logger.warn('[Socket message_read] Error: ' + e.message);
    }
  });

  socket.on('message_delivered', async (data: { messageId: string }) => {
    try {
      if (!userId || !data.messageId) return;
      await ChatService.markMessageDelivered(data.messageId, userId);
    } catch (e: any) {
      logger.warn('[Socket message_delivered] Error: ' + e.message);
    }
  });

  socket.on('typing_start', async (conversationId: string) => {
    if (!conversationId) return;
    await FirestoreIntegration.setTypingIndicator(conversationId, userId, true).catch(() => {});
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping: true,
    });
  });

  socket.on('typing_stop', async (conversationId: string) => {
    if (!conversationId) return;
    await FirestoreIntegration.setTypingIndicator(conversationId, userId, false).catch(() => {});
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping: false,
    });
  });
};
