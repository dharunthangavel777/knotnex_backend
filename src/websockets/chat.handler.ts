import { Server, Socket } from 'socket.io';
import { ChatService } from '../services/chat.service';
import { logger } from '../config/logger';

export const registerChatHandlers = (io: Server, socket: Socket) => {
  // Join specific conversation room after participant authorization check
  socket.on('join_conversation', async (conversationId: string, ack?: (resp: any) => void) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId || !conversationId) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid conversation' });
      return;
    }

    try {
      const isParticipant = await ChatService.verifyParticipant(conversationId, userId);
      if (!isParticipant) {
        socket.emit('chat_error', { message: 'Unauthorized conversation access' });
        if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized conversation access' });
        return;
      }

      socket.join(`conversation_${conversationId}`);
      if (typeof ack === 'function') ack({ ok: true, conversationId });
    } catch (error: any) {
      logger.error(`[Socket] Error joining conversation ${conversationId}:`, error);
      if (typeof ack === 'function') ack({ ok: false, error: error.message });
    }
  });

  socket.on('leave_conversation', (conversationId: string) => {
    if (conversationId) {
      socket.leave(`conversation_${conversationId}`);
    }
  });

  // Real-time idempotent message send with acknowledgement callback
  socket.on(
    'send_message',
    async (
      data: {
        conversationId?: string;
        recipientId?: string;
        receiverId?: string;
        content?: string;
        messageType?: string;
        mediaUrl?: string;
        replyToId?: string;
        clientMessageId?: string;
        forwardedFromMessageId?: string;
        metadata?: Record<string, any>;
        attachments?: any[];
      },
      ack?: (resp: { ok: boolean; message?: any; error?: string }) => void
    ) => {
      try {
        const senderId = socket.data.userId as string | undefined;
        if (!senderId) {
          socket.emit('chat_error', { message: 'Authentication required' });
          if (typeof ack === 'function') ack({ ok: false, error: 'Authentication required' });
          return;
        }

        const msg = await ChatService.sendMessage({
          conversationId: data.conversationId,
          senderId,
          recipientId: data.recipientId || data.receiverId,
          content: data.content || '',
          messageType: data.messageType,
          mediaUrl: data.mediaUrl,
          replyToId: data.replyToId,
          clientMessageId: data.clientMessageId,
          forwardedFromMessageId: data.forwardedFromMessageId,
          metadata: data.metadata,
          attachments: data.attachments,
        });

        if (typeof ack === 'function') {
          ack({ ok: true, message: msg });
        }
      } catch (error: any) {
        socket.emit('chat_error', {
          message: error.message,
          clientMessageId: data?.clientMessageId,
        });
        if (typeof ack === 'function') {
          ack({ ok: false, error: error.message });
        }
      }
    }
  );

  // Mark messages as read
  socket.on('message_read', async (data: { conversationId?: string; messageId?: string }) => {
    try {
      const userId = socket.data.userId as string | undefined;
      if (!userId || !data?.conversationId) return;

      if (data.messageId) {
        await ChatService.markMessageRead(data.conversationId, data.messageId, userId);
      } else {
        await ChatService.markConversationAsRead(data.conversationId, userId);
      }
    } catch (error: any) {
      logger.error(`[Socket] Error in message_read:`, error);
    }
  });

  // Acknowledge message delivery
  socket.on('message_delivered', async (data: { messageId?: string }) => {
    try {
      const userId = socket.data.userId as string | undefined;
      if (!userId || !data?.messageId) return;
      await ChatService.markMessageDelivered(data.messageId, userId);
    } catch (error: any) {
      logger.error(`[Socket] Error in message_delivered:`, error);
    }
  });

  // Authorized typing indicators routed directly to peer's user room
  socket.on('typing_start', async (payload: string | { conversationId?: string; recipientId?: string }) => {
    try {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
      if (!conversationId) return;

      const peerId = await ChatService.getAuthorizedPeerId(conversationId, userId);
      if (!peerId) return;

      io.to(`user:${peerId}`).emit('typing_start', {
        conversationId,
        userId,
      });
    } catch (error: any) {
      logger.warn('[Socket] typing_start error: ' + error.message);
    }
  });

  socket.on('typing_stop', async (payload: string | { conversationId?: string; recipientId?: string }) => {
    try {
      const userId = socket.data.userId as string | undefined;
      if (!userId) return;
      const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
      if (!conversationId) return;

      const peerId = await ChatService.getAuthorizedPeerId(conversationId, userId);
      if (!peerId) return;

      io.to(`user:${peerId}`).emit('typing_stop', {
        conversationId,
        userId,
      });
    } catch (error: any) {
      logger.warn('[Socket] typing_stop error: ' + error.message);
    }
  });
};
