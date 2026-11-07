import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Conversation endpoints
router.get('/conversations', authenticate, ChatController.listConversations);
router.get('/requests', authenticate, ChatController.listMessageRequests);
router.get('/discover-users', authenticate, ChatController.discoverUsers);
router.get('/conversations/:id', authenticate, ChatController.getMessages);
router.post('/conversations', authenticate, ChatController.startConversation);
router.patch('/conversations/:id/accept', authenticate, ChatController.acceptRequest);
router.patch('/conversations/:id/reject', authenticate, ChatController.rejectRequest);
router.patch('/conversations/:id/pin', authenticate, ChatController.togglePin);
router.patch('/conversations/:id/archive', authenticate, ChatController.toggleArchive);
router.delete('/conversations/:id', authenticate, ChatController.deleteConversation);
router.patch('/conversations/:id/read-all', authenticate, ChatController.markConversationAsRead);

// Message endpoints
router.post('/messages', authenticate, ChatController.sendMessage);
router.patch('/conversations/:conversationId/messages/:messageId/read', authenticate, ChatController.markAsRead);
router.patch('/messages/:id/read', authenticate, ChatController.markAsRead);
router.patch('/messages/:id/delivered', authenticate, ChatController.markDelivered);
router.delete('/messages/:id', authenticate, ChatController.deleteMessage);
router.post('/messages/:id/reactions', authenticate, ChatController.toggleReaction);
router.post('/messages/:id/report', authenticate, ChatController.reportMessage);

// Social & presence endpoints
router.get('/unread-count', authenticate, ChatController.getUnreadCount);
router.get('/search-users', authenticate, ChatController.searchUsers);
router.post('/users/:id/block', authenticate, ChatController.blockUser);
router.delete('/users/:id/block', authenticate, ChatController.unblockUser);

export default router;
