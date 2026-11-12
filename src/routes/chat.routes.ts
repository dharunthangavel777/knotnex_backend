import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Conversation endpoints
router.get('/conversations', authenticate, ChatController.listConversations);
router.get('/requests', authenticate, ChatController.listMessageRequests);
router.get('/discover-users', authenticate, ChatController.discoverUsers);
router.get('/messages/search', authenticate, ChatController.searchMessages);
router.get('/attachments/:attachmentId/content', authenticate, ChatController.streamAttachmentContent);
router.get('/attachments/:attachmentId/signed-url', authenticate, ChatController.getAttachmentSignedUrl);
router.get('/media/:assetId/content', authenticate, ChatController.streamUploadedAssetContent);
router.post('/presence/query', authenticate, ChatController.getPresence);
router.get('/conversations/:id', authenticate, ChatController.getMessages);
router.get('/conversations/:id/messages', authenticate, ChatController.getMessages);
router.post('/conversations', authenticate, ChatController.startConversation);
router.patch('/conversations/:id/accept', authenticate, ChatController.acceptRequest);
router.patch('/conversations/:id/reject', authenticate, ChatController.rejectRequest);
router.patch('/conversations/:id/pin', authenticate, ChatController.togglePin);
router.patch('/conversations/:id/archive', authenticate, ChatController.toggleArchive);
router.patch('/conversations/:id/mute', authenticate, ChatController.toggleMute);
router.post('/conversations/:id/clear', authenticate, ChatController.clearConversation);
router.delete('/conversations/:id', authenticate, ChatController.deleteConversation);
router.patch('/conversations/:id/read-all', authenticate, ChatController.markConversationAsRead);

// Message endpoints
router.post('/messages', authenticate, ChatController.sendMessage);
router.post('/messages/:id/forward', authenticate, ChatController.forwardMessage);
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
