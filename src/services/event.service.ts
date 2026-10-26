import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import { generateSlug } from '../utils/slug.util';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { EventStatus } from '../types/enums';

const DEV_EVENTS_FILE = path.resolve(process.cwd(), 'src/db/dev_events_store.json');

let isDbOnline = true;
let lastDbFailure = 0;

function canAttemptDb(): boolean {
  if (!isDbOnline && Date.now() - lastDbFailure < 60000) {
    return false;
  }
  return true;
}

function recordDbFailure() {
  isDbOnline = false;
  lastDbFailure = Date.now();
}

function readDevEvents(): any[] {
  try {
    if (fs.existsSync(DEV_EVENTS_FILE)) {
      const content = fs.readFileSync(DEV_EVENTS_FILE, 'utf8');
      return JSON.parse(content) || [];
    }
  } catch (_) {}
  return [];
}

function writeDevEvents(events: any[]) {
  try {
    const dir = path.dirname(DEV_EVENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEV_EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[EventService] Failed to persist dev event store:', err.message);
  }
}

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

    // Resolve valid organization ID and user ID
    let validOrgId = orgId || '20000000-0000-0000-0000-000000000001';
    let validUserId = userId || '00000000-0000-0000-0000-000000000001';

    if (canAttemptDb()) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId || '');
        if (isUuid) {
          const orgCheck = await query(`SELECT id, owner_id FROM organizations WHERE id = $1 LIMIT 1`, [orgId]);
          if (orgCheck.rows[0]) {
            validOrgId = orgCheck.rows[0].id;
            if (!validUserId) validUserId = orgCheck.rows[0].owner_id;
          }
        }
      } catch (e: any) {
        recordDbFailure();
      }
    }
    const initialStatus = data.status || 'draft';

    let createdRow: any = null;
    if (canAttemptDb()) {
      try {
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
        ]
      );
      createdRow = res.rows[0];
    } catch (dbErr: any) {
      recordDbFailure();
      console.warn('[EventService] PostgreSQL insert timed out/unreachable, saving to dev store:', dbErr.message);
    }
  }

    if (!createdRow) {
      createdRow = {
        id: `evt-${Date.now()}`,
        org_id: validOrgId || '20000000-0000-0000-0000-000000000001',
        created_by: validUserId || '00000000-0000-0000-0000-000000000001',
        title,
        slug,
        category: data.category || 'General',
        type: data.type || 'In-Person',
        cover_url: coverUrl,
        short_description: shortDescription,
        detailed_description: detailedDescription,
        language: data.language || 'English',
        event_date: eventDate,
        start_time: data.startTime || data.time || '10:00:00',
        end_time: data.endTime || '17:00:00',
        timezone: data.timezone || 'Asia/Kolkata',
        venue_name: venueName || 'Venue TBD',
        address: data.address || null,
        district: data.district || null,
        state: data.state || null,
        google_maps_link: data.googleMapsLink || null,
        meeting_platform: data.meetingPlatform || null,
        meeting_link: data.meetingLink || null,
        wheelchair_accessible: Boolean(data.wheelchairAccessible),
        sign_language: Boolean(data.signLanguage),
        braille_material: Boolean(data.brailleMaterial),
        capacity: data.capacity ? Number(data.capacity) : 500,
        is_free: isFree,
        ticket_price: ticketPrice,
        status: initialStatus,
        eligibility: data.eligibility || [],
        sponsors: data.sponsors || [],
        gallery: data.gallery || [],
        contact_email: data.contactEmail || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        org_name: 'Verified Organization',
        org_logo: null,
        registration_count: 0,
      };
    }

    // Always update dev store
    const devEvents = readDevEvents();
    const existingIdx = devEvents.findIndex(e => String(e.id) === String(createdRow.id));
    if (existingIdx >= 0) {
      devEvents[existingIdx] = { ...devEvents[existingIdx], ...createdRow };
    } else {
      devEvents.unshift(createdRow);
    }
    writeDevEvents(devEvents);

    return createdRow;
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
      conditions.push(`e.category = $${idx++}`);
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
    if (params.wheelchairOnly) {
      conditions.push(`e.wheelchair_accessible = true`);
    }
    if (params.search) {
      conditions.push(`(e.title ILIKE $${idx} OR e.short_description ILIKE $${idx} OR e.venue_name ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let dbRows: any[] = [];
    if (canAttemptDb()) {
      try {
        const eventsRes = await query(
          `SELECT e.*,
                  COALESCE(o.name, 'Verified Organization') as org_name,
                  o.logo_url as org_logo,
                  COALESCE((SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id), 0) AS registration_count
           FROM events e
           LEFT JOIN organizations o ON (e.org_id = o.id OR e.created_by = o.owner_id)
           ${whereClause}
           ORDER BY e.created_at DESC, e.event_date DESC
           LIMIT $${idx++} OFFSET $${idx++}`,
          [...values, limit, offset]
        );
        dbRows = eventsRes.rows || [];
      } catch (dbErr: any) {
        recordDbFailure();
        console.warn('[EventService] PostgreSQL listEvents failed/unreachable, loading from dev store:', dbErr.message);
      }
    }

    // Merge with dev store
    const devList = readDevEvents();
    const filteredDev = devList.filter(e => {
      if (params.category && e.category?.toLowerCase() !== params.category.toLowerCase()) return false;
      if (params.type && e.type?.toLowerCase() !== params.type.toLowerCase()) return false;
      if (params.status && e.status?.toLowerCase() !== params.status.toLowerCase()) return false;
      if (params.search) {
        const q = params.search.toLowerCase();
        const matches =
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.short_description && e.short_description.toLowerCase().includes(q)) ||
          (e.venue_name && e.venue_name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });

    const idMap = new Map<string, any>();
    for (const r of dbRows) idMap.set(String(r.id), r);
    for (const r of filteredDev) idMap.set(String(r.id), { ...idMap.get(String(r.id)), ...r });

    const merged = Array.from(idMap.values());
    merged.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const total = merged.length;
    const paginated = merged.slice(offset, offset + limit);

    return buildPaginatedResult(paginated, total, page, limit);
  }

  static async getEventById(id: string) {
    if (canAttemptDb()) {
      try {
        const res = await query(
          `SELECT e.*,
                  COALESCE(o.name, 'Verified Organization') as org_name,
                  o.logo_url as org_logo,
                  o.about as org_about,
                  COALESCE((SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id), 0) AS registration_count
           FROM events e
           LEFT JOIN organizations o ON (e.org_id = o.id OR e.created_by = o.owner_id)
           WHERE e.id = $1`,
          [id]
        );
        if (res.rows[0]) return res.rows[0];
      } catch (_) {
        recordDbFailure();
      }
    }

    const devList = readDevEvents();
    return devList.find(e => String(e.id) === String(id)) || null;
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

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (data[camel] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[camel]);
      }
    }

    let updatedRow: any = null;
    if (fields.length > 0 && canAttemptDb()) {
      fields.push('updated_at = NOW()');
      try {
        const res = await query(
          `UPDATE events SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
          values
        );
        updatedRow = res.rows[0];
      } catch (_) {
        recordDbFailure();
      }
    }

    // Always update dev store
    const devList = readDevEvents();
    const storeIdx = devList.findIndex(e => String(e.id) === String(id));
    if (storeIdx >= 0) {
      devList[storeIdx] = {
        ...devList[storeIdx],
        ...data,
        status: data.status || devList[storeIdx].status,
        updated_at: new Date().toISOString(),
      };
      writeDevEvents(devList);
      if (!updatedRow) updatedRow = devList[storeIdx];
    }

    return updatedRow || (await this.getEventById(id));
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

    try {
      const res = await query(
        `SELECT e.*, o.name as org_name, o.logo_url as org_logo
         FROM events e
         JOIN organizations o ON e.org_id = o.id
         WHERE e.id != $1 AND (e.category = $2 OR e.type = $3) AND e.event_date >= CURRENT_DATE
         ORDER BY e.event_date ASC
         LIMIT 4`,
        [eventId, currentEvent.category, currentEvent.type]
      );
      if (res.rows.length > 0) return res.rows;
    } catch (_) {}

    const devList = readDevEvents();
    return devList.filter(e => String(e.id) !== String(eventId) && (e.category === currentEvent.category || e.type === currentEvent.type)).slice(0, 4);
  }
}

