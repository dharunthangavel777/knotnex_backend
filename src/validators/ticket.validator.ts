import { z } from 'zod';
import { TicketPriority, TicketStatus } from '../types/enums';

export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(3, 'Subject is required'),
    category: z.string().min(2, 'Category is required'),
    priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
    description: z.string().min(10, 'Description is required'),
    attachments: z.array(z.string().url()).default([]),
  }),
});

export const updateTicketStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(TicketStatus),
  }),
});

export const replyTicketSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Reply message is required'),
    attachments: z.array(z.string().url()).default([]),
  }),
});
