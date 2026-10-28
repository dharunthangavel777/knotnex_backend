import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import { generateSlug } from '../utils/slug.util';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { EventStatus } from '../types/enums';

export const inMemoryEvents: any[] = [];

export class EventService {
  static async createEvent(orgId: string, userId: string, data: any) {
    const title = data.title || data.name || 'Untitled Event';
    const slug = generateSlug(title);
    const coverUrl = data.coverUrl || data.poster || null;
    const eventDate = data.eventDate || data.date || new Date().toISOString().split('T')[0];
    const venueName = data.venueName || data.location || null;
    const detailedDescription = data.detailedDescription || data.description || null;
    const shortDescription = data.shortDescription || (detailedDescription ? detailedDescription.substring(0, 160) : null);
    const ticketPrice = data.ticketPrice !== undefined ? (typeof data.ticketPrice === 'number' ? data.ticketPrice : parseFloat(String(data.ticketPrice).replace(/[^0-9.]/g, '')) || 0) : 0;
    const isFree = data.isFree !== undefined ? data.isFree : ticketPrice === 0;
    const initialStatus = data.status || EventStatus.PENDING_VERIFICATION;

    try {
      const res = await query(
        `INSERT INTO events (
          org_id, created_by, title, slug, category, type, cover_url,
          short_description, detailed_description, language, event_date,
          start_time, end_time, timezone, registration_opens, registration_deadline,
          venue_name, address, district, state, google_maps_link,
          meeting_platform, meeting_link, wheelchair_accessible, sign_language,
          braille_material, capacity, is_free, ticket_price, status, eligibility,
          sponsors, gallery, contact_email, is_verified
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
          $32, $33, $34, $35
        ) RETURNING *`,
        [
          validOrgId,
          validUserId,
          title,
          slug,
          data.category || 'General',
          data.type || 'In-Person',
          coverUrl,
          shortDescription,
          detailedDescription,
          data.language || 'English',
          eventDate,
          data.startTime || data.time || null,
          data.endTime || null,
          data.timezone || 'Asia/Kolkata',
          data.registrationOpens || null,
          data.registrationDeadline || null,
          venueName,
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
          isFree,
          ticketPrice,
          initialStatus,
          data.eligibility || [],
          JSON.stringify(data.sponsors || []),
          data.gallery || [],
          data.contactEmail || null,
          initialStatus === EventStatus.PUBLISHED,
        ]
      );

      const created = res.rows[0];
      inMemoryEvents.unshift(created);
      return created;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const devEvent = {
          id: `ev-${Date.now()}`,
          org_id: orgId,
          created_by: userId,
          title,
          slug,
          category: data.category || 'General',
          type: data.type || 'In-Person',
          cover_url: coverUrl,
          short_description: shortDescription,
          detailed_description: detailedDescription,
          event_date: eventDate,
          start_time: data.startTime || data.time || '10:00:00',
          end_time: data.endTime || '17:00:00',
          venue_name: venueName,
          capacity: data.capacity || 500,
          registered_count: 0,
          is_free: isFree,
          ticket_price: ticketPrice,
          status: initialStatus,
          is_verified: initialStatus === EventStatus.PUBLISHED,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryEvents.unshift(devEvent);
        return devEvent;
      }
      throw err;
    }
  }

  static async listEvents(params: {
    page?: any;
    limit?: any;
    category?: string;
    type?: string;
    status?: string;
    search?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.category) {
      conditions.push(`e.category ILIKE $${idx++}`);
      values.push(params.category);
    }
    if (params.type) {
      conditions.push(`e.type = $${idx++}`);
      values.push(params.type);
    }
    if (params.status) {
      conditions.push(`e.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.search) {
      conditions.push(`(e.title ILIKE $${idx} OR e.short_description ILIKE $${idx} OR e.venue_name ILIKE $${idx})`);
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
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        let filtered = [...inMemoryEvents];
        if (params.orgId) {
          filtered = filtered.filter(e => e.org_id === params.orgId);
        }
        if (params.status) {
          filtered = filtered.filter(e => e.status === params.status);
        } else if (!params.orgId) {
          filtered = filtered.filter(e => ['published', 'upcoming', 'ongoing'].includes(e.status));
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }
      throw err;
    }
  }

  static async getEventById(id: string) {
    try {
      const res = await query(
        `SELECT e.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about
         FROM events e
         JOIN organizations o ON e.org_id = o.id
         WHERE e.id = $1`,
        [id]
      );
      return res.rows[0] || null;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        return inMemoryEvents.find((e: any) => String(e.id) === String(id)) || null;
      }
      throw err;
    }
  }

  static async updateEvent(id: string, data: any) {
    if (data.name && !data.title) data.title = data.name;
    if (data.poster && !data.coverUrl) data.coverUrl = data.poster;
    if (data.date && !data.eventDate) data.eventDate = data.date;
    if (data.location && !data.venueName) data.venueName = data.location;
    if (data.description && !data.detailedDescription) data.detailedDescription = data.description;
    if (data.ticketPrice !== undefined && typeof data.ticketPrice === 'string') {
      data.ticketPrice = parseFloat(data.ticketPrice.replace(/[^0-9.]/g, '')) || 0;
    }

    const allowed = [
      'title', 'category', 'type', 'cover_url', 'short_description', 'detailed_description',
      'language', 'event_date', 'start_time', 'end_time', 'timezone', 'venue_name', 'address',
      'district', 'state', 'wheelchair_accessible', 'sign_language', 'braille_material',
      'capacity', 'is_free', 'ticket_price', 'status'
    ];

    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    const allowed = [
      'title', 'category', 'type', 'cover_url', 'short_description', 'detailed_description',
      'language', 'event_date', 'start_time', 'end_time', 'timezone', 'registration_opens',
      'registration_deadline', 'venue_name', 'address', 'district', 'state', 'google_maps_link',
      'meeting_platform', 'meeting_link', 'wheelchair_accessible', 'sign_language',
      'braille_material', 'capacity', 'is_free', 'ticket_price', 'status', 'eligibility',
      'sponsors', 'gallery', 'contact_email'
    ];

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      const val = data[camel] !== undefined ? data[camel] : data[key];
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[camel]);
      }
    }

    if (fields.length === 0) return this.getEventById(id);

    fields.push('updated_at = NOW()');

    try {
      const res = await query(
        `UPDATE events SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );

      return res.rows[0];
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const ev = inMemoryEvents.find((e: any) => String(e.id) === String(id));
        if (ev) {
          Object.assign(ev, data, { updated_at: new Date().toISOString() });
          return ev;
        }
      }
      throw err;
    }
  }

  static async deleteEvent(id: string) {
    if (canAttemptDb()) {
      try {
        await query(`DELETE FROM events WHERE id = $1`, [id]);
      } catch (_) {
        recordDbFailure();
      }
    }

    const devList = readDevEvents();
    writeDevEvents(devList.filter(e => String(e.id) !== String(id)));
    return { success: true };
  }

  static async saveEvent(userId: string, eventId: string) {
    try {
      await query(
        `INSERT INTO saved_items (user_id, item_id, item_type)
         VALUES ($1, $2, 'event')
         ON CONFLICT (user_id, item_id, item_type) DO NOTHING`,
        [userId, eventId]
      );
    } catch (_) {}
    return { saved: true };
  }

  static async unsaveEvent(userId: string, eventId: string) {
    try {
      await query(
        `DELETE FROM saved_items WHERE user_id = $1 AND item_id = $2 AND item_type = 'event'`,
        [userId, eventId]
      );
    } catch (_) {}
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
