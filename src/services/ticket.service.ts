import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { TicketStatus, TicketPriority } from '../types/enums';

export class TicketService {
  static async createTicket(creatorId: string, data: any) {
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

    const countRes = await query(`SELECT COUNT(*) FROM tickets t ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const ticketsRes = await query(
      `SELECT t.*, u.full_name as creator_name, u.email as creator_email
       FROM tickets t
       JOIN users u ON t.creator_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return buildPaginatedResult(ticketsRes.rows, total, page, limit);
  }

  static async getTicketById(id: string) {
    const ticketRes = await query(
      `SELECT t.*, u.full_name as creator_name, u.email as creator_email
       FROM tickets t
       JOIN users u ON t.creator_id = u.id
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
  }

  static async updateStatus(id: string, status: TicketStatus) {
    const res = await query(
      `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0];
  }

  static async assignTicket(id: string, assignedTo: string) {
    const res = await query(
      `UPDATE tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [assignedTo, id]
    );
    return res.rows[0];
  }

  static async addReply(ticketId: string, authorId: string, data: { message: string; attachments?: string[] }) {
    const res = await query(
      `INSERT INTO ticket_replies (ticket_id, author_id, message, attachments)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticketId, authorId, data.message, data.attachments || []]
    );
    return res.rows[0];
  }
}
