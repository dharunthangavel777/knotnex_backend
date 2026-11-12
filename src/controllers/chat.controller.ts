import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { ChatMessagingService } from '../services/chat-messaging.service';
import { ChatMediaService } from '../services/chat-media.service';
import { ChatSearchService } from '../services/chat-search.service';
import { PresenceService } from '../services/presence.service';
import { ApiResponse } from '../utils/response.util';

export class ChatController {
  static async listConversations(req: Request, res: Response) {
    try {
      const archived = req.query.archived === 'true';
      const conversations = await ChatService.listUserConversations(req.user!.id, archived);
      return ApiResponse.success(res, conversations);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async listMessageRequests(req: Request, res: Response) {
    try {
      const requests = await ChatService.listMessageRequests(req.user!.id);
      return ApiResponse.success(res, requests);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async acceptRequest(req: Request, res: Response) {
    try {
      const conversationId = req.params.id;
      const result = await ChatService.acceptRequest(conversationId, req.user!.id);
      return ApiResponse.success(res, result, 'Request accepted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async rejectRequest(req: Request, res: Response) {
    try {
      const conversationId = req.params.id;
      const result = await ChatService.rejectRequest(conversationId, req.user!.id);
      return ApiResponse.success(res, result, 'Request rejected');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async togglePin(req: Request, res: Response) {
    try {
      const conversationId = req.params.id;
      const result = await ChatService.togglePin(conversationId, req.user!.id);
      return ApiResponse.success(res, result, result.isPinned ? 'Conversation pinned' : 'Conversation unpinned');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async toggleArchive(req: Request, res: Response) {
    try {
      const conversationId = req.params.id;
      const result = await ChatService.toggleArchive(conversationId, req.user!.id);
      return ApiResponse.success(res, result, result.isArchived ? 'Conversation archived' : 'Conversation unarchived');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async deleteConversation(req: Request, res: Response) {
    try {
      const conversationId = req.params.id;
      const result = await ChatService.deleteConversationForUser(conversationId, req.user!.id);
      return ApiResponse.success(res, result, 'Conversation deleted from inbox');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async discoverUsers(req: Request, res: Response) {
    try {
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const results = await ChatService.discoverUsers(req.user!.id, limit);
      return ApiResponse.success(res, results);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getMessages(req: Request, res: Response) {
    try {
      const currentUserId = req.user!.id;
      const targetId = req.params.id;
      const limit = parseInt((req.query.limit as string) || '35', 10);
      const before = (req.query.before as string) || (req.query.cursor as string) || undefined;
      const after = (req.query.after as string) || undefined;
      const aroundMessageId = (req.query.aroundMessageId as string) || undefined;

      const data = await ChatService.getConversationOrDirectMessages(currentUserId, targetId, limit, {
        before,
        after,
        aroundMessageId,
      });
      return ApiResponse.success(res, data);
    } catch (error: any) {
      const code = error.statusCode || 500;
      return ApiResponse.error(res, error.message, code);
    }
  }

  static async startConversation(req: Request, res: Response) {
    try {
      const participantId = req.body.participantId || req.body.receiverId;
      if (!participantId) {
        return ApiResponse.error(res, 'participantId or receiverId is required', 400);
      }
      const conversation = await ChatService.startConversation(req.user!.id, participantId);
      return ApiResponse.created(res, conversation);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const currentUserId = req.user!.id;
      let conversationId = req.body.conversationId;
      const recipientId = req.body.receiverId || req.body.recipientId;

      if (!conversationId && recipientId) {
        const conv = await ChatService.startConversation(currentUserId, recipientId);
        conversationId = conv.id;
      }

      if (!conversationId) {
        return ApiResponse.error(res, 'Either conversationId or receiverId is required', 400);
      }

      const message = await ChatService.sendMessage({
        conversationId,
        senderId: currentUserId,
        recipientId,
        content: req.body.content || '',
        messageType: req.body.messageType,
        mediaUrl: req.body.mediaUrl,
        replyToId: req.body.replyToId || req.body.replyTo,
        clientMessageId: req.body.clientMessageId,
        forwardedFromMessageId: req.body.forwardedFromMessageId,
        metadata: req.body.metadata,
        attachments: req.body.attachments,
      });
      return ApiResponse.created(res, message);
    } catch (error: any) {
      const code = error.statusCode || 400;
      return ApiResponse.error(res, error.message, code);
    }
  }

  static async markConversationAsRead(req: Request, res: Response) {
    try {
      const conversationId = req.params.id;
      const result = await ChatService.markConversationAsRead(conversationId, req.user!.id);
      return ApiResponse.success(res, result, 'Conversation marked as read');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const conversationId = req.params.conversationId || req.body.conversationId || '';
      const messageId = req.params.messageId || req.params.id;
      const result = await ChatService.markMessageRead(conversationId, messageId, req.user!.id);
      return ApiResponse.success(res, result, 'Message marked as read');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async markDelivered(req: Request, res: Response) {
    try {
      const messageId = req.params.id;
      const result = await ChatService.markMessageDelivered(messageId, req.user!.id);
      return ApiResponse.success(res, result, 'Message marked as delivered');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async deleteMessage(req: Request, res: Response) {
    try {
      const messageId = req.params.id;
      const rawScope = (req.query.scope as string) || (req.body?.scope as string) || 'me';
      const scope: 'me' | 'everyone' = rawScope === 'everyone' ? 'everyone' : 'me';
      const result = await ChatService.deleteMessage(messageId, req.user!.id, scope);
      return ApiResponse.success(res, result, 'Message deleted');
    } catch (error: any) {
      const code = error.statusCode || 400;
      return ApiResponse.error(res, error.message, code);
    }
  }

  static async toggleReaction(req: Request, res: Response) {
    try {
      const messageId = req.params.id;
      const emoji = req.body.emoji;
      if (!emoji) {
        return ApiResponse.error(res, 'emoji is required', 400);
      }
      const result = await ChatService.toggleReaction(messageId, req.user!.id, emoji);
      return ApiResponse.success(res, result, 'Reaction updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async blockUser(req: Request, res: Response) {
    try {
      const blockedId = req.params.id;
      const reason = req.body.reason;
      const result = await ChatService.blockUser(req.user!.id, blockedId, reason);
      return ApiResponse.success(res, result, 'User blocked');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async unblockUser(req: Request, res: Response) {
    try {
      const blockedId = req.params.id;
      const result = await ChatService.unblockUser(req.user!.id, blockedId);
      return ApiResponse.success(res, result, 'User unblocked');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async reportMessage(req: Request, res: Response) {
    try {
      const messageId = req.params.id;
      const reason = req.body.reason;
      if (!reason) {
        return ApiResponse.error(res, 'reason is required', 400);
      }
      const result = await ChatService.reportMessage(messageId, req.user!.id, reason);
      return ApiResponse.success(res, result, 'Message reported');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getUnreadCount(req: Request, res: Response) {
    try {
      const count = await ChatService.getUnreadCount(req.user!.id);
      return ApiResponse.success(res, { count, unreadCount: count });
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async searchUsers(req: Request, res: Response) {
    try {
      const queryText = (req.query.q as string) || '';
      const results = await ChatService.searchUsers(req.user!.id, queryText);
      return ApiResponse.success(res, results);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async toggleMute(req: Request, res: Response) {
    try {
      const result = await ChatMessagingService.toggleMute(req.params.id, req.user!.id, {
        muted: req.body?.muted,
        mutedUntil: req.body?.mutedUntil,
      });
      return ApiResponse.success(res, result, 'Mute preference updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, error.statusCode || 400);
    }
  }

  static async clearConversation(req: Request, res: Response) {
    try {
      const result = await ChatMessagingService.clearConversationForUser(req.params.id, req.user!.id);
      return ApiResponse.success(res, result, 'Chat cleared');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, error.statusCode || 400);
    }
  }

  static async forwardMessage(req: Request, res: Response) {
    try {
      const targetConversationIds = Array.isArray(req.body?.targetConversationIds)
        ? req.body.targetConversationIds
        : undefined;
      const targetRecipientIds = Array.isArray(req.body?.targetRecipientIds)
        ? req.body.targetRecipientIds
        : undefined;
      const results = await ChatService.forwardMessage(req.params.id, req.user!.id, {
        targetConversationIds,
        targetRecipientIds,
        clientMessageIdPrefix: req.body?.clientMessageIdPrefix,
      });
      return ApiResponse.created(res, { messages: results });
    } catch (error: any) {
      return ApiResponse.error(res, error.message, error.statusCode || 400);
    }
  }

  static async searchMessages(req: Request, res: Response) {
    try {
      const data = await ChatSearchService.searchMessages(req.user!.id, {
        queryText: (req.query.q as string) || '',
        conversationId: (req.query.conversationId as string) || undefined,
        attachmentType: (req.query.type as string) || (req.query.attachmentType as string) || undefined,
        senderId: (req.query.senderId as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 30,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      });
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async streamAttachmentContent(req: Request, res: Response) {
    try {
      await ChatMediaService.streamAuthorizedAttachment(req, res, req.params.attachmentId, req.user!.id);
    } catch (error: any) {
      if (!res.headersSent) {
        ApiResponse.error(res, error.message, error.statusCode || 500);
      }
    }
  }

  static async getAttachmentSignedUrl(req: Request, res: Response) {
    try {
      const result = await ChatMediaService.getAuthorizedAttachmentSignedUrl(
        req.params.attachmentId,
        req.user!.id
      );
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, error.statusCode || 404);
    }
  }

  static async streamUploadedAssetContent(req: Request, res: Response) {
    try {
      await ChatMediaService.streamAuthorizedAsset(req, res, req.params.assetId, req.user!.id);
    } catch (error: any) {
      if (!res.headersSent) {
        ApiResponse.error(res, error.message, error.statusCode || 500);
      }
    }
  }

  static async getPresence(req: Request, res: Response) {
    try {
      const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
      const presence = await PresenceService.getPresenceForUsers(req.user!.id, userIds);
      return ApiResponse.success(res, { presence });
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
