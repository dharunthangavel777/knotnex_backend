import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { ApiResponse } from '../utils/response.util';

export class ChatController {
  static async listConversations(req: Request, res: Response) {
    try {
      const conversations = await ChatService.listUserConversations(req.user!.id);
      return ApiResponse.success(res, conversations);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getMessages(req: Request, res: Response) {
    try {
      const messages = await ChatService.getConversationMessages(req.params.id);
      return ApiResponse.success(res, messages);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async startConversation(req: Request, res: Response) {
    try {
      const conversation = await ChatService.startConversation(req.user!.id, req.body.participantId);
      return ApiResponse.created(res, conversation);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const message = await ChatService.sendMessage({
        conversationId: req.body.conversationId,
        senderId: req.user!.id,
        content: req.body.content,
        messageType: req.body.messageType,
        mediaUrl: req.body.mediaUrl,
        replyTo: req.body.replyTo,
        metadata: req.body.metadata,
      });
      return ApiResponse.created(res, message);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const result = await ChatService.markMessageRead(req.params.conversationId, req.params.messageId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
