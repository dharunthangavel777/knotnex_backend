import { Router } from 'express';
import { TicketController } from '../controllers/ticket.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { validate } from '../middleware/validator.middleware';
import { createTicketSchema, updateTicketStatusSchema, replyTicketSchema } from '../validators/ticket.validator';

const router = Router();

router.post('/', authenticate, validate(createTicketSchema), TicketController.createTicket);
router.get('/', authenticate, TicketController.listTickets);
router.get('/:id', authenticate, TicketController.getTicketById);
router.patch('/:id/status', authenticate, requireAdmin, validate(updateTicketStatusSchema), TicketController.updateStatus);
router.patch('/:id/assign', authenticate, requireAdmin, TicketController.assignTicket);
router.post('/:id/reply', authenticate, validate(replyTicketSchema), TicketController.addReply);

export default router;
