import { query } from '../config/database';
import { config } from '../config';
import { generateSlug } from '../utils/slug.util';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { EventStatus } from '../types/enums';
import { config } from '../config';

export const inMemoryEvents: any[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    org_id: '20000000-0000-0000-0000-000000000001',
    created_by: '00000000-0000-0000-0000-000000000001',
    title: 'vxv',
    slug: 'vxv',
    category: 'Education',
    type: 'In-Person',
    cover_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    short_description: 'Inclusive education and skilling initiative for students with diverse learning abilities.',
    detailed_description: 'Inclusive education and skilling initiative for students with diverse learning abilities.',
    language: 'English',
    event_date: '2026-10-06',
    start_time: '10:00:00',
    end_time: '16:00:00',
    timezone: 'Asia/Kolkata',
    venue_name: 'Bengaluru, Karnataka',
    address: 'Kumar School Campus, Jayanagar, Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    wheelchair_accessible: true,
    sign_language: true,
    braille_material: false,
    capacity: 9999,
    registered_count: 0,
    is_free: true,
    ticket_price: 0,
    status: 'published',
    is_verified: true,
    org_name: 'Kumar School',
    org_logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    org_id: '20000000-0000-0000-0000-000000000002',
    created_by: '00000000-0000-0000-0000-000000000001',
    title: 'Tech & AI Innovators Global Summit 2026',
    slug: 'tech-ai-innovators-global-summit-2026-vyarahr',
    category: 'Technology',
    type: 'In-Person',
    cover_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    short_description: 'Global gathering of leaders and developers driving accessible AI tools.',
    detailed_description: 'Global gathering of leaders and developers driving accessible AI tools.',
    language: 'English',
    event_date: '2026-11-17',
    start_time: '09:30:00',
    end_time: '18:00:00',
    timezone: 'Asia/Kolkata',
    venue_name: 'Bengaluru International Exhibition Centre (BIEC), Bengaluru',
    address: '10th Mile, Tumkur Road, Madavara Post, Bengaluru, Karnataka 562123',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    wheelchair_accessible: true,
    sign_language: true,
    braille_material: true,
    capacity: 9999,
    registered_count: 0,
    is_free: true,
    ticket_price: 0,
    status: 'published',
    is_verified: true,
    org_name: 'VyaraHR',
    org_logo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    org_id: '20000000-0000-0000-0000-000000000001',
    created_by: '00000000-0000-0000-0000-000000000001',
    title: 'Tech & AI Innovators Global Summit 2026',
    slug: 'tech-ai-innovators-global-summit-2026-kumar',
    category: 'Technology',
    type: 'In-Person',
    cover_url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&auto=format&fit=crop&q=80',
    short_description: 'Inclusive education and assistive hardware demonstrations.',
    detailed_description: 'Inclusive education and assistive hardware demonstrations.',
    language: 'English',
    event_date: '2026-11-17',
    start_time: '09:30:00',
    end_time: '18:00:00',
    timezone: 'Asia/Kolkata',
    venue_name: 'Bengaluru International Exhibition Centre (BIEC), Bengaluru',
    address: '10th Mile, Tumkur Road, Madavara Post, Bengaluru, Karnataka 562123',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    wheelchair_accessible: true,
    sign_language: false,
    braille_material: true,
    capacity: 9999,
    registered_count: 0,
    is_free: true,
    ticket_price: 0,
    status: 'published',
    is_verified: true,
    org_name: 'Kumar School',
    org_logo: '',
    created_at: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    org_id: '20000000-0000-0000-0000-000000000001',
    created_by: '00000000-0000-0000-0000-000000000001',
    title: 'Tech & AI Innovators Global Summit 2026',
    slug: 'tech-ai-innovators-global-summit-2026-kumar-2',
    category: 'Technology',
    type: 'In-Person',
    cover_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&auto=format&fit=crop&q=80',
    short_description: 'Workshops on assistive listening devices and screen reader compatibility.',
    detailed_description: 'Workshops on assistive listening devices and screen reader compatibility.',
    language: 'English',
    event_date: '2026-11-17',
    start_time: '09:30:00',
    end_time: '18:00:00',
    timezone: 'Asia/Kolkata',
    venue_name: 'Bengaluru International Exhibition Centre (BIEC), Bengaluru',
    address: '10th Mile, Tumkur Road, Madavara Post, Bengaluru, Karnataka 562123',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    wheelchair_accessible: true,
    sign_language: true,
    braille_material: false,
    capacity: 9999,
    registered_count: 0,
    is_free: true,
    ticket_price: 0,
    status: 'published',
    is_verified: true,
    org_name: 'Kumar School',
    org_logo: '',
    created_at: new Date(Date.now() - 9 * 86400 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export class EventService {
  static async createEvent(orgId: string, userId: string, data: any) {
    const title = data.title || data.name || 'Untitled Event';
    const slug = generateSlug(title);
    const coverUrl = data.coverUrl || data.poster || null;
    let eventDate = data.eventDate || data.date || new Date().toISOString().split('T')[0];
    if (typeof eventDate === 'string' && eventDate.includes('•')) {
      eventDate = eventDate.split('•')[0].trim();
    }
    const venueName = data.venueName || data.location || null;
    const detailedDescription = data.detailedDescription || data.description || null;
    const shortDescription = data.shortDescription || (detailedDescription ? detailedDescription.substring(0, 160) : null);
    const ticketPrice = data.ticketPrice !== undefined ? (typeof data.ticketPrice === 'number' ? data.ticketPrice : parseFloat(String(data.ticketPrice).replace(/[^0-9.]/g, '')) || 0) : 0;
    const isFree = data.isFree !== undefined ? Boolean(data.isFree) : ticketPrice === 0;
    const initialStatus = data.status || EventStatus.PENDING_VERIFICATION;
    const validOrgId = orgId && orgId !== 'undefined' && orgId !== 'null' ? orgId : null;
    const validUserId = userId && userId !== 'undefined' && userId !== 'null' ? userId : null;
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
          orgId,
          userId,
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
          org_id: validOrgId,
          created_by: validUserId,
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
    orgId?: sg;f5518
  }) {
    const { page, limit, offset } = getPagination(params);
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (params.category && params.category !== 'all') {
      conditions.push(`e.category ILIKE $${idx++}`);
      values.push(params.category);
    }
    if (params.type && params.type !== 'all') {
      conditions.push(`e.type = $${idx++}`);
      values.push(params.type);
    }
    if (params.status && params.status !== 'all') {
      const s = params.status.toLowerCase();
      if (s === 'pending' || s === 'pending_approval' || s === 'pending_verification') {
        conditions.push(`(e.status IN ('draft', 'pending', 'pending_approval', 'pending_verification') OR e.is_verified = false)`);
      } else if (s === 'upcoming') {
        conditions.push(`e.status = 'upcoming' AND e.is_verified = true`);
      } else if (s === 'ongoing') {
        conditions.push(`e.status = 'ongoing' AND e.is_verified = true`);
      } else if (s === 'completed') {
        conditions.push(`e.status = 'completed'`);
      } else if (s === 'cancelled' || s === 'rejected') {
        conditions.push(`e.status IN ('cancelled', 'rejected')`);
      } else {
        conditions.push(`e.status = $${idx++}`);
        values.push(params.status);
      }
    }
    const targetOrgId = params.orgId || params.org_id;
    if (targetOrgId) {
      conditions.push(`e.org_id = $${idx++}`);
      values.push(targetOrgId);
    }
    if (params.search) {
      conditions.push(`(e.title ILIKE $${idx} OR e.short_description ILIKE $${idx} OR e.venue_name ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
<<<<<<< HEAD
      const countRes = await query(`SELECT COUNT(*) FROM events e ${whereClause}`, values);
      const total = parseInt(countRes.rows[0]?.count || '0', 10);
======= 
      const countRes = await query(`SELECT COUNT(*) FROM events ${whereClause}`, values);
      const total = parseInt(countRes.rows[0].count, 10);
>>>>>>> a62269b67b1b0708a9d7f1ea3af43281ab5f5518

      const eventsRes = await query(
        `SELECT e.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about
         FROM events e
         LEFT JOIN organizations o ON e.org_id = o.id
         ${whereClause}
         ORDER BY e.event_date ASC, e.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      if (eventsRes.rows.length > 0) {
        return buildPaginatedResult(eventsRes.rows, total, page, limit);
      }

      // Dev fallback if DB has no rows matching
      if (config.env === 'development' || !config.isProduction) {
        let filtered = [...inMemoryEvents];
        if (targetOrgId) {
          filtered = filtered.filter(e => e.org_id === targetOrgId);
        }
        if (params.status && params.status !== 'all') {
          const s = params.status.toLowerCase();
          filtered = filtered.filter(e => (e.status || '').toLowerCase() === s);
        }
        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = filtered.filter(e => (e.title || '').toLowerCase().includes(q) || (e.venue_name || '').toLowerCase().includes(q));
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }

      return buildPaginatedResult([], 0, page, limit);
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        let filtered = [...inMemoryEvents];
        if (targetOrgId) {
          filtered = filtered.filter(e => e.org_id === targetOrgId);
        }
        if (params.status && params.status !== 'all') {
          const s = params.status.toLowerCase();
          filtered = filtered.filter(e => (e.status || '').toLowerCase() === s);
        }
        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = filtered.filter(e => (e.title || '').toLowerCase().includes(q) || (e.venue_name || '').toLowerCase().includes(q));
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
         LEFT JOIN organizations o ON e.org_id = o.id
         WHERE e.id = $1`,
        [id]
      );
      if (res.rows[0]) return res.rows[0];
      return inMemoryEvents.find((e: any) => String(e.id) === String(id)) || null;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        return inMemoryEvents.find((e: any) => String(e.id) === String(id)) || null;
      }
      throw err;
    }
  }

  static async updateEvent(id: string, data: any) {
    // 1. Normalize field aliases from org dash and admin portal
    const title = data.title || data.name;
    const coverUrl = data.coverUrl || data.cover_url || data.poster;
    let eventDate = data.eventDate || data.event_date || data.date;
    const venueName = data.venueName || data.venue_name || data.location;
    const detailedDescription = data.detailedDescription || data.detailed_description || data.description;
    const shortDescription = data.shortDescription || data.short_description || (detailedDescription ? String(detailedDescription).substring(0, 160) : undefined);
    let startTime = data.startTime || data.start_time || data.time;
    let capacity = data.capacity !== undefined ? (typeof data.capacity === 'number' ? data.capacity : parseInt(String(data.capacity), 10) || null) : undefined;
    let ticketPrice = data.ticketPrice !== undefined ? (typeof data.ticketPrice === 'number' ? data.ticketPrice : parseFloat(String(data.ticketPrice).replace(/[^0-9.]/g, '')) || 0) : undefined;
    let isFree = data.isFree !== undefined ? Boolean(data.isFree) : (ticketPrice !== undefined ? ticketPrice === 0 : undefined);

    // Sanitize eventDate if it has time component or bullet
    if (eventDate) {
      if (typeof eventDate === 'string' && eventDate.includes('•')) {
        const parts = eventDate.split('•').map((s: string) => s.trim());
        eventDate = parts[0];
        if (parts[1] && !startTime) startTime = parts[1];
      }
      try {
        const d = new Date(eventDate);
        if (!isNaN(d.getTime())) {
          eventDate = d.toISOString().split('T')[0];
        }
      } catch {}
    }

<<<<<<< HEAD
    if (startTime && typeof startTime === 'string') {
      const match = startTime.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
     if (match) startTime = match[1];
    }

    // Sanitize status to database check constraint
    let status = data.status;
    if (status) {
      const s = String(status).toLowerCase();
      if (['pendingapproval', 'pending_approval', 'pending', 'pending_verification'].includes(s)) {
        status = 'draft';
      } else if (['active', 'approved', 'published', 'verified & live', 'verified'].includes(s)) {
        status = 'published';
      } else if (['rejected', 'inactive', 'cancelled'].includes(s)) {
        status = 'cancelled';
      } else if (['completed'].includes(s)) {
        status = 'completed';
      } else if (['ongoing'].includes(s)) {
        status = 'ongoing';
      } else if (['upcoming'].includes(s)) {
        status = 'upcoming';
======= 
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
>>>>>>> a62269b67b1b0708a9d7f1ea3af43281ab5f5518
      }
    }

    let isVerified = data.isVerified !== undefined ? data.isVerified : data.is_verified;
    if (status === 'published' && isVerified === undefined) {
      isVerified = true;
    }

    const updates: { col: string; val: any }[] = [];

    if (title !== undefined) updates.push({ col: 'title', val: title });
    if (data.category !== undefined) updates.push({ col: 'category', val: data.category });
    if (data.type !== undefined) updates.push({ col: 'type', val: data.type });
    if (coverUrl !== undefined) updates.push({ col: 'cover_url', val: coverUrl });
    if (shortDescription !== undefined) updates.push({ col: 'short_description', val: shortDescription });
    if (detailedDescription !== undefined) updates.push({ col: 'detailed_description', val: detailedDescription });
    if (data.language !== undefined) updates.push({ col: 'language', val: data.language });
    if (eventDate !== undefined) updates.push({ col: 'event_date', val: eventDate });
    if (startTime !== undefined) updates.push({ col: 'start_time', val: startTime });
    if (data.endTime !== undefined || data.end_time !== undefined) updates.push({ col: 'end_time', val: data.endTime || data.end_time });
    if (data.timezone !== undefined) updates.push({ col: 'timezone', val: data.timezone });
    if (venueName !== undefined) updates.push({ col: 'venue_name', val: venueName });
    if (data.address !== undefined) updates.push({ col: 'address', val: data.address });
    if (data.district !== undefined) updates.push({ col: 'district', val: data.district });
    if (data.state !== undefined) updates.push({ col: 'state', val: data.state });
    if (data.wheelchairAccessible !== undefined || data.wheelchair_accessible !== undefined) {
      updates.push({ col: 'wheelchair_accessible', val: Boolean(data.wheelchairAccessible ?? data.wheelchair_accessible) });
    }
    if (data.signLanguage !== undefined || data.sign_language !== undefined) {
      updates.push({ col: 'sign_language', val: Boolean(data.signLanguage ?? data.sign_language) });
    }
    if (data.brailleMaterial !== undefined || data.braille_material !== undefined) {
      updates.push({ col: 'braille_material', val: Boolean(data.brailleMaterial ?? data.braille_material) });
    }
    if (capacity !== undefined) updates.push({ col: 'capacity', val: capacity });
    if (isFree !== undefined) updates.push({ col: 'is_free', val: isFree });
    if (ticketPrice !== undefined) updates.push({ col: 'ticket_price', val: ticketPrice });
    if (status !== undefined) updates.push({ col: 'status', val: status });
    if (isVerified !== undefined) updates.push({ col: 'is_verified', val: isVerified });
    if (data.eligibility !== undefined) updates.push({ col: 'eligibility', val: Array.isArray(data.eligibility) ? data.eligibility : [data.eligibility] });
    if (data.sponsors !== undefined) updates.push({ col: 'sponsors', val: JSON.stringify(data.sponsors) });
    if (data.gallery !== undefined) updates.push({ col: 'gallery', val: Array.isArray(data.gallery) ? data.gallery : [data.gallery] });
    if (data.contactEmail !== undefined || data.contact_email !== undefined) {
      updates.push({ col: 'contact_email', val: data.contactEmail || data.contact_email });
    }
    if (data.orgId || data.org_id) {
      updates.push({ col: 'org_id', val: data.orgId || data.org_id });
    }

    if (updates.length === 0) {
      return this.getEventById(id);
    }

    const setClauses = updates.map((u, i) => `${u.col} = $${i + 2}`);
    setClauses.push('updated_at = NOW()');
    const values = [id, ...updates.map(u => u.val)];

    try {
      const res = await query(
        `UPDATE events SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );

      const updatedRow = res.rows[0];

      // Keep in-memory event in sync
      const inMem = inMemoryEvents.find((e: any) => String(e.id) === String(id));
      if (inMem) {
        updates.forEach(u => {
          inMem[u.col] = u.val;
          const camel = u.col.replace(/_([a-z])/g, g => g[1].toUpperCase());
          inMem[camel] = u.val;
        });
        if (data.organizer || data.org_name) {
          inMem.org_name = data.organizer || data.org_name;
        }
        inMem.updated_at = new Date().toISOString();
      }

      return updatedRow || inMem;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const ev = inMemoryEvents.find((e: any) => String(e.id) === String(id));
        if (ev) {
          updates.forEach(u => {
            ev[u.col] = u.val;
            const camel = u.col.replace(/_([a-z])/g, g => g[1].toUpperCase());
            ev[camel] = u.val;
          });
          if (data.organizer || data.org_name) {
            ev.org_name = data.organizer || data.org_name;
          }
          ev.updated_at = new Date().toISOString();
          return ev;
        }
      }
      throw err;
    }
  }

  static async deleteEvent(id: string) {
    try {
      await query(`DELETE FROM events WHERE id = $1`, [id]);
<<<<<<< HEAD
      const idx = inMemoryEvents.findIndex((e: any) => String(e.id) === String(id));
      if (idx !== -1) inMemoryEvents.splice(idx, 1);
      return { success: true };
=======
>>>>>>> a62269b67b1b0708a9d7f1ea3af43281ab5f5518
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const idx = inMemoryEvents.findIndex((e: any) => String(e.id) === String(id));
        if (idx !== -1) inMemoryEvents.splice(idx, 1);
        return { success: true };
      }
      throw err;
    }
<<<<<<< HEAD
=======

    const idx = inMemoryEvents.findIndex((e: any) => String(e.id) === String(id));
    if (idx !== -1) inMemoryEvents.splice(idx, 1);
    return { success: true };
>>>>>>> a62269b67b1b0708a9d7f1ea3af43281ab5f5518
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
       LEFT JOIN organizations o ON e.org_id = o.id
       WHERE e.id != $1 AND (e.category = $2 OR e.type = $3) AND e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC
       LIMIT 4`,
      [eventId, currentEvent.category, currentEvent.type]
    );

    return res.rows;
  }
}
