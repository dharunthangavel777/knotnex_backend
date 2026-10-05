import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/conversations', authenticate, ChatController.listConversations);
router.get('/conversations/:id', authenticate, ChatController.getMessages);
router.post('/conversations', authenticate, ChatController.startConversation);
router.post('/messages', authenticate, ChatController.sendMessage);
router.patch('/conversations/:conversationId/messages/:messageId/read', authenticate, ChatController.markAsRead);

export default router;
