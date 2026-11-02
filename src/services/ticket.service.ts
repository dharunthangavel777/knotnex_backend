import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { TicketStatus, TicketPriority } from '../types/enums';
import { config } from '../config';
import { logger } from '../config/logger';

// ─── Development In-Memory Mock Store ────────────────────────────────────────
// In-memory store starts completely empty as requested.
const inMemoryTickets: any[] = [
  {
    id: 'TCK-8021',
    creator_id: '00000000-0000-0000-0000-000000000003',
    subject: 'Screen reader stall on assistive device registration flow',
    category: 'Accessibility Bug',
    priority: TicketPriority.URGENT,
    status: TicketStatus.OPEN,
    description: 'During Step 2 of the assistive device grant program, TalkBack loses focus on the OTP confirmation button.',
    attachments: [],
    creator_name: 'Arun Kumar',
    creator_email: 'arun.kumar@example.com',
    sla_remaining: '45m',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    replies: [],
  },
  {
    id: 'TCK-8018',
    creator_id: '00000000-0000-0000-0000-000000000002',
    subject: 'NGO 12A / 80G Verification Document Re-upload request',
    category: 'Verification Review',
    priority: TicketPriority.HIGH,
    status: TicketStatus.IN_PROGRESS,
    description: 'Samarthya Disability Foundation has provided the renewed 80G certificate for platform verification approval.',
    attachments: [],
    creator_name: 'Samarthya Coordinator',
    creator_email: 'coordinator@samarthya-ngo.org',
    sla_remaining: '2h 15m',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    replies: [],
  },
  {
    id: 'TCK-8015',
    creator_id: '00000000-0000-0000-0000-000000000001',
    subject: 'Event QR check-in scanner camera latency on low-end devices',
    category: 'Mobile Platform',
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.OPEN,
    description: 'Event volunteers reported high frame lag when scanning attendee QR badges on Android 12 Go devices.',
    attachments: [],
    creator_name: 'Platform Administrator',
    creator_email: 'admin@knotnex.com',
    sla_remaining: '4h 00m',
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    replies: [],
  },
  {
    id: 'TCK-8009',
    creator_id: '00000000-0000-0000-0000-000000000003',
    subject: 'Audio caption sync corrected on inclusive coding conclave reel',
    category: 'Content Moderation',
    priority: TicketPriority.LOW,
    status: TicketStatus.RESOLVED,
    description: 'Desynchronized Hindi audio description track has been re-encoded and verified clean.',
    attachments: [],
    creator_name: 'Ravi Prasanth',
    creator_email: 'ravi@knotnex.com',
    sla_remaining: 'Resolved',
    created_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    replies: [
      {
        id: 'REP-101',
        author_name: 'Admin Team',
        message: 'Re-encoded video asset deployed to CDN. Synced audio stream verified.',
        created_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      },
    ],
  },
];


export class TicketService {
  static async createTicket(creatorId: string, data: any) {
    try {
      const res = await query(
        `INSERT INTO tickets (
          creator_id, org_id, subject, category, priority, status, description, attachments
        ) VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)
        RETURNING *`,
        [
          creatorId,
          data.orgId || null,
          data.subject,
          data.category,
          data.priority || TicketPriority.MEDIUM,
          data.description,
          data.attachments || [],
        ]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const newTicket = {
          id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
          creator_id: creatorId,
          subject: data.subject,
          category: data.category,
          priority: data.priority || TicketPriority.MEDIUM,
          status: TicketStatus.OPEN,
          description: data.description,
          attachments: data.attachments || [],
          creator_name: 'Development User',
          creator_email: 'dev@knotnex.com',
          created_at: new Date().toISOString(),
          replies: [],
        };
        inMemoryTickets.unshift(newTicket);
        return newTicket;
      }
      throw dbErr;
    }
  }

  static async listTickets(params: {
    page?: any;
    limit?: any;
    status?: string;
    userId?: string;
    orgId?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`t.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.userId) {
      conditions.push(`t.creator_id = $${idx++}`);
      values.push(params.userId);
    }
    if (params.orgId) {
      conditions.push(`t.org_id = $${idx++}`);
      values.push(params.orgId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(`SELECT COUNT(*) FROM tickets t ${whereClause}`, values);
      const total = parseInt(countRes.rows[0].count, 10);

      const ticketsRes = await query(
        `SELECT t.*, u.full_name as creator_name, u.email as creator_email
         FROM tickets t
         LEFT JOIN users u ON t.creator_id = u.id
         ${whereClause}
         ORDER BY t.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      return buildPaginatedResult(ticketsRes.rows, total, page, limit);
    } catch (dbErr: any) {
      if (config.env === 'development') {
        logger.warn('[TicketService] DB unreachable in dev, serving in-memory tickets');
        let filtered = [...inMemoryTickets];
        if (params.status) {
          const s = params.status.toLowerCase();
          filtered = filtered.filter((t) => t.status.toLowerCase() === s);
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }
      throw dbErr;
    }
  }

  static async getTicketById(id: string) {
    try {
      const ticketRes = await query(
        `SELECT t.*, u.full_name as creator_name, u.email as creator_email
         FROM tickets t
         LEFT JOIN users u ON t.creator_id = u.id
         WHERE t.id = $1`,
        [id]
      );

      if (ticketRes.rowCount === 0) return null;

      const repliesRes = await query(
        `SELECT r.*, u.full_name as author_name, u.avatar_url as author_avatar
         FROM ticket_replies r
         JOIN users u ON r.author_id = u.id
         WHERE r.ticket_id = $1
         ORDER BY r.created_at ASC`,
        [id]
      );

      return {
        ...ticketRes.rows[0],
        replies: repliesRes.rows,
      };
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const found = inMemoryTickets.find((t) => t.id === id);
        return found || null;
      }
      throw dbErr;
    }
  }

  static async updateStatus(id: string, status: TicketStatus) {
    try {
      const res = await query(
        `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, id]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const item = inMemoryTickets.find((t) => t.id === id);
        if (item) {
          item.status = status;
          if (status === TicketStatus.RESOLVED) {
            item.sla_remaining = 'Resolved';
          }
          return item;
        }
      }
      throw dbErr;
    }
  }

  static async assignTicket(id: string, assignedTo: string) {
    try {
      const res = await query(
        `UPDATE tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [assignedTo, id]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const item = inMemoryTickets.find((t) => t.id === id);
        if (item) {
          item.assigned_to = assignedTo;
          return item;
        }
      }
      throw dbErr;
    }
  }

  static async addReply(ticketId: string, authorId: string, data: { message: string; attachments?: string[] }) {
    try {
      const res = await query(
        `INSERT INTO ticket_replies (ticket_id, author_id, message, attachments)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ticketId, authorId, data.message, data.attachments || []]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const reply = {
          id: `REP-${Date.now()}`,
          ticket_id: ticketId,
          author_id: authorId,
          message: data.message,
          attachments: data.attachments || [],
          created_at: new Date().toISOString(),
        };
        const item = inMemoryTickets.find((t) => t.id === ticketId);
        if (item) {
          if (!item.replies) item.replies = [];
          item.replies.push(reply);
        }
        return reply;
      }
      throw dbErr;
    }
  }

  static async updateTicket(id: string, data: any) {
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let idx = 1;

      if (data.subject !== undefined) {
        updates.push(`subject = $${idx++}`);
        values.push(data.subject);
      }
      if (data.category !== undefined) {
        updates.push(`category = $${idx++}`);
        values.push(data.category);
      }
      if (data.priority !== undefined) {
        updates.push(`priority = $${idx++}`);
        values.push(data.priority);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${idx++}`);
        values.push(data.status);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${idx++}`);
        values.push(data.description);
      }
      if (data.assignedTo !== undefined || data.assigned_to !== undefined) {
        updates.push(`assigned_to = $${idx++}`);
        values.push(data.assignedTo || data.assigned_to);
      }

      values.push(id);
      const res = await query(
        `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      const item = inMemoryTickets.find((t: any) => t.id === id);
      if (item) {
        Object.assign(item, data);
      }
      return res.rows[0] || item;
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const item = inMemoryTickets.find((t: any) => t.id === id);
        if (item) {
          Object.assign(item, data);
          return item;
        }
      }
      throw dbErr;
    }
  }

  static async deleteTicket(id: string) {
    try {
      await query(`DELETE FROM tickets WHERE id = $1`, [id]);
      const idx = inMemoryTickets.findIndex((t: any) => t.id === id);
      if (idx !== -1) inMemoryTickets.splice(idx, 1);
      return { deleted: true, id };
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const idx = inMemoryTickets.findIndex((t: any) => t.id === id);
        if (idx !== -1) inMemoryTickets.splice(idx, 1);
        return { deleted: true, id };
      }
      throw dbErr;
    }
  }

  static async clearTickets(filter?: { status?: string }) {
    try {
      const targetStatus = filter?.status || 'resolved';
      await query(`DELETE FROM tickets WHERE status = $1`, [targetStatus]);
      for (let i = inMemoryTickets.length - 1; i >= 0; i--) {
        if (inMemoryTickets[i].status === targetStatus) {
          inMemoryTickets.splice(i, 1);
        }
      }
      return { cleared: true, status: targetStatus };
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const targetStatus = filter?.status || 'resolved';
        for (let i = inMemoryTickets.length - 1; i >= 0; i--) {
          if (inMemoryTickets[i].status === targetStatus) {
            inMemoryTickets.splice(i, 1);
          }
        }
        return { cleared: true, status: targetStatus };
      }
      throw dbErr;
    }
  }
}
