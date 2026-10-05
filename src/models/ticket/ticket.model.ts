import { BaseModel } from '../common/base.model';
import { TicketPriority, TicketStatus } from '../../types/enums';

export interface TicketModel extends BaseModel {
  creatorId: string;
  orgId?: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  attachments: string[];
  assignedTo?: string;
}

export interface TicketReplyModel extends BaseModel {
  ticketId: string;
  authorId: string;
  message: string;
  attachments: string[];
}
