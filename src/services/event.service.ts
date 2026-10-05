import { query } from '../config/database';
import { generateSlug } from '../utils/slug.util';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { EventStatus } from '../types/enums';

export class EventService {
  static async createEvent(orgId: string, userId: string, data: any) {
    const slug = generateSlug(data.title);

    const res = await query(
      `INSERT INTO events (
        org_id, created_by, title, slug, category, type, cover_url,
        short_description, detailed_description, language, event_date,
        start_time, end_time, timezone, registration_opens, registration_deadline,
        venue_name, address, district, state, google_maps_link,
        meeting_platform, meeting_link, wheelchair_accessible, sign_language,
        braille_material, capacity, is_free, ticket_price, status, eligibility,
        sponsors, gallery, contact_email
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
        $32, $33, $34
      ) RETURNING *`,
      [
        orgId,
        userId,
        data.title,
        slug,
        data.category,
        data.type,
        data.coverUrl || null,
        data.shortDescription || null,
        data.detailedDescription || null,
        data.language || 'English',
        data.eventDate,
        data.startTime || null,
        data.endTime || null,
        data.timezone || 'Asia/Kolkata',
        data.registrationOpens || null,
        data.registrationDeadline || null,
        data.venueName || null,
        data.address || null,
        data.district || null,
        data.state || null,
        data.googleMapsLink || null,
        data.meetingPlatform || null,
        data.meetingLink || null,
        data.wheelchairAccessible || false,
        data.signLanguage || false,
        data.brailleMaterial || false,
        data.capacity || null,
        data.isFree !== undefined ? data.isFree : true,
        data.ticketPrice || 0,
        data.status || EventStatus.DRAFT,
        data.eligibility || [],
        JSON.stringify(data.sponsors || []),
        data.gallery || [],
        data.contactEmail || null,
      ]
    );

    return res.rows[0];
  }

  static async listEvents(params: {
    page?: any;
    limit?: any;
    category?: string;
    type?: string;
    status?: string;
    wheelchairOnly?: boolean;
    search?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.category) {
      conditions.push(`category = $${idx++}`);
      values.push(params.category);
    }
    if (params.type) {
      conditions.push(`type = $${idx++}`);
      values.push(params.type);
    }
    if (params.status) {
      conditions.push(`status = $${idx++}`);
      values.push(params.status);
    }
    if (params.wheelchairOnly) {
      conditions.push(`wheelchair_accessible = true`);
    }
    if (params.search) {
      conditions.push(`(title ILIKE $${idx} OR short_description ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM events ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const eventsRes = await query(
      `SELECT e.*, o.name as org_name, o.logo_url as org_logo
       FROM events e
       JOIN organizations o ON e.org_id = o.id
       ${whereClause}
       ORDER BY e.event_date ASC, e.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return buildPaginatedResult(eventsRes.rows, total, page, limit);
  }

  static async getEventById(id: string) {
    const res = await query(
      `SELECT e.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about
       FROM events e
       JOIN organizations o ON e.org_id = o.id
       WHERE e.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async updateEvent(id: string, data: any) {
    const allowed = [
      'title', 'category', 'type', 'cover_url', 'short_description', 'detailed_description',
      'language', 'event_date', 'start_time', 'end_time', 'timezone', 'venue_name', 'address',
      'district', 'state', 'wheelchair_accessible', 'sign_language', 'braille_material',
      'capacity', 'is_free', 'ticket_price', 'status'
    ];

    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (data[camel] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[camel]);
      }
    }

    if (fields.length === 0) return this.getEventById(id);

    fields.push('updated_at = NOW()');

    const res = await query(
      `UPDATE events SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return res.rows[0];
  }

  static async deleteEvent(id: string) {
    await query(`DELETE FROM events WHERE id = $1`, [id]);
    return { success: true };
  }

  static async saveEvent(userId: string, eventId: string) {
    await query(
      `INSERT INTO saved_items (user_id, item_id, item_type)
       VALUES ($1, $2, 'event')
       ON CONFLICT (user_id, item_id, item_type) DO NOTHING`,
      [userId, eventId]
    );
    return { saved: true };
  }

  static async unsaveEvent(userId: string, eventId: string) {
    await query(
      `DELETE FROM saved_items WHERE user_id = $1 AND item_id = $2 AND item_type = 'event'`,
      [userId, eventId]
    );
    return { saved: false };
  }

  static async getSimilarEvents(eventId: string) {
    const currentEvent = await this.getEventById(eventId);
    if (!currentEvent) return [];

    const res = await query(
      `SELECT e.*, o.name as org_name, o.logo_url as org_logo
       FROM events e
       JOIN organizations o ON e.org_id = o.id
       WHERE e.id != $1 AND (e.category = $2 OR e.type = $3) AND e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC
       LIMIT 4`,
      [eventId, currentEvent.category, currentEvent.type]
    );

    return res.rows;
  }
}
