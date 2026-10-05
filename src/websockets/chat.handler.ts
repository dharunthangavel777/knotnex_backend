import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chat.service';
import { FirestoreIntegration } from '../integrations/firebase/firestore.firebase';
import { logger } from '../config/logger';

export const registerChatHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  socket.on('join_conversation', (conversationId: string) => {
    socket.join(`conversation_${conversationId}`);
    logger.debug(`User ${userId} joined room conversation_${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(`conversation_${conversationId}`);
    logger.debug(`User ${userId} left room conversation_${conversationId}`);
  });

  socket.on('send_message', async (data: {
    conversationId: string;
    content: string;
    messageType?: any;
    mediaUrl?: string;
    replyTo?: any;
    metadata?: any;
  }) => {
    try {
      const message = await ChatService.sendMessage({
        conversationId: data.conversationId,
        senderId: userId,
        content: data.content,
        messageType: data.messageType,
        mediaUrl: data.mediaUrl,
        replyTo: data.replyTo,
        metadata: data.metadata,
      });

      // Broadcast to room
      io.to(`conversation_${data.conversationId}`).emit('new_message', message);
    } catch (error: any) {
      socket.emit('chat_error', { message: error.message });
    }
  });

  socket.on('typing_start', async (conversationId: string) => {
    await FirestoreIntegration.setTypingIndicator(conversationId, userId, true);
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping: true,
    });
  });

  socket.on('typing_stop', async (conversationId: string) => {
    await FirestoreIntegration.setTypingIndicator(conversationId, userId, false);
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping: false,
    });
  });
};
