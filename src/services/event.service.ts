import { query } from '../config/database';
import { config } from '../config';
import { generateSlug } from '../utils/slug.util';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { EventStatus } from '../types/enums';

export const inMemoryEvents: any[] = [];

export function formatEventResponse(row: any) {
  if (!row) return null;
  const parseJson = (val: any, fallback: any = null) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  const schedule = parseJson(row.schedule, []);
  const speakers = parseJson(row.speakers, []);
  const faqs = parseJson(row.faqs, []);
  const volunteers = parseJson(row.volunteers, []);
  const sponsors = parseJson(row.sponsors, []);
  const regSettings = parseJson(row.registration_settings, {});
  const accFeatures = parseJson(row.accessibility_features, {});
  const contactEmerg = parseJson(row.contact_and_emergency, {});
  const mediaAttach = parseJson(row.media_attachments, {});
  const merchantAcc = parseJson(row.merchant_account, null);

  const eventDate = row.event_date
    ? (row.event_date instanceof Date ? row.event_date.toISOString().split('T')[0] : String(row.event_date).split('T')[0])
    : '';
  const startTime = row.start_time ? String(row.start_time).substring(0, 8) : '';
  const endTime = row.end_time ? String(row.end_time).substring(0, 8) : '';

  return {
    ...row,
    schedule,
    speakers,
    faqs,
    volunteers,
    sponsors,
    registration_settings: regSettings,
    accessibility_features: accFeatures,
    contact_and_emergency: contactEmerg,
    media_attachments: mediaAttach,
    merchant_account: merchantAcc,

    // Nested DTO contract directly matching Flutter EventModel
    dateAndTime: {
      eventDate,
      startTime,
      endTime,
      registrationOpens: row.registration_opens,
      registrationDeadline: row.registration_deadline || '',
      timeZone: row.timezone || 'IST',
    },
    location: {
      venueName: row.venue_name || '',
      address: row.address || '',
      landmark: row.landmark || '',
      district: row.district || '',
      state: row.state || '',
      pincode: row.pincode || '',
      googleMapsLink: row.google_maps_link || '',
      meetingPlatform: row.meeting_platform || '',
      meetingLink: row.meeting_link || '',
      passcode: row.meeting_passcode || '',
    },
    organizer: {
      name: row.org_name || 'KnotNex Organizer',
      avatar: row.org_logo || null,
      organization: row.org_name || 'KnotNex',
      contactPerson: row.contact_person || 'Coordinator',
      email: row.contact_email || 'events@knotnex.org',
      phone: row.contact_phone || '',
      website: row.org_website || null,
      merchantAccount: merchantAcc,
    },
    accessibility: {
      wheelchairAccessible: Boolean(row.wheelchair_accessible || accFeatures.wheelchairAccessible),
      accessibleParking: Boolean(accFeatures.accessibleParking),
      accessibleRestroom: Boolean(accFeatures.accessibleRestroom),
      rampAvailable: Boolean(accFeatures.rampAvailable),
      elevatorAvailable: Boolean(accFeatures.elevatorAvailable),
      signLanguageInterpreter: Boolean(row.sign_language || accFeatures.signLanguageInterpreter || accFeatures.signLanguage),
      liveCaptioning: Boolean(accFeatures.liveCaptioning),
      brailleMaterials: Boolean(row.braille_material || accFeatures.brailleMaterials || accFeatures.brailleMaterial),
      hearingLoop: Boolean(accFeatures.hearingLoop),
      assistanceVolunteers: Boolean(accFeatures.assistanceVolunteers),
      caregiverAllowed: Boolean(accFeatures.caregiverAllowed),
    },
    details: {
      speakers,
      schedule,
      sponsors,
      volunteers,
      faqs,
      chiefGuests: Array.isArray(row.chief_guests) ? row.chief_guests : [],
      maximumParticipants: row.capacity,
      dressCode: row.dress_code || null,
    },
    registrationSettings: {
      registrationRequired: regSettings.registrationRequired !== false,
      approvalRequired: Boolean(regSettings.approvalRequired),
      isPaid: !row.is_free,
      ticketPrice: Number(row.ticket_price || 0),
      registrationLimit: row.capacity || regSettings.registrationLimit,
      waitingList: Boolean(regSettings.waitingList),
      qrCheckIn: regSettings.qrCheckIn !== false,
      certificateAvailable: Boolean(regSettings.certificateAvailable),
      customQuestions: regSettings.customQuestions || [],
      merchantAccount: merchantAcc,
    },
    media: {
      galleryImages: Array.isArray(row.gallery) && row.gallery.length > 0 ? row.gallery : (mediaAttach.galleryImages || []),
      videos: mediaAttach.videos || [],
      brochurePdf: mediaAttach.brochurePdf || null,
      eventRulesPdf: mediaAttach.eventRulesPdf || null,
    },
    contactAndEmergency: {
      emergencyContact: contactEmerg.emergencyContact || contactEmerg.phone || row.contact_phone || null,
      helpDeskNumber: contactEmerg.helpDeskNumber || contactEmerg.helpDesk || null,
      medicalSupportAvailable: Boolean(contactEmerg.medicalSupportAvailable),
      ambulanceAvailable: Boolean(contactEmerg.ambulanceAvailable),
    },
    // Top-level field aliases matching Flutter EventModel & Admin models
    coverUrl: row.cover_url || '',
    shortDescription: row.short_description || '',
    detailedDescription: row.detailed_description || '',
    isVerified: Boolean(row.is_verified),
    participantsCount: Number(row.registered_count || 0),
  };
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
    const initialStatus = data.status || EventStatus.PENDING_VERIFICATION;

    const schedule = JSON.stringify(data.schedule || data.sessions || []);
    const speakers = JSON.stringify(data.speakers || []);
    const chiefGuests = Array.isArray(data.chiefGuests) ? data.chiefGuests : [];
    const faqs = JSON.stringify(data.faqs || []);
    const volunteers = JSON.stringify(data.volunteers || []);
    const regSettings = JSON.stringify(data.registrationSettings || data.registration_settings || {});
    const accFeatures = JSON.stringify(data.accessibilityFeatures || data.accessibility || {});
    const contactEmerg = JSON.stringify(data.contactAndEmergency || data.contact_and_emergency || data.contact || {});
    const mediaAttach = JSON.stringify(data.mediaAttachments || data.media || {});
    const merchantAcc = JSON.stringify(data.merchantAccount || data.merchant_account || null);

    try {
      const res = await query(
        `INSERT INTO events (
          org_id, created_by, title, slug, category, type, cover_url,
          short_description, detailed_description, language, event_date,
          start_time, end_time, timezone, registration_opens, registration_deadline,
          venue_name, address, district, state, google_maps_link,
          meeting_platform, meeting_link, wheelchair_accessible, sign_language,
          braille_material, capacity, is_free, ticket_price, status, eligibility,
          sponsors, gallery, contact_email, is_verified,
          schedule, speakers, chief_guests, faqs, volunteers,
          registration_settings, accessibility_features, contact_and_emergency,
          media_attachments, merchant_account, landmark, pincode, meeting_passcode
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
          $32, $33, $34, $35,
          $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48
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
          schedule,
          speakers,
          chiefGuests,
          faqs,
          volunteers,
          regSettings,
          accFeatures,
          contactEmerg,
          mediaAttach,
          merchantAcc,
          data.landmark || null,
          data.pincode || null,
          data.meetingPasscode || data.passcode || null,
        ]
      );

      const created = res.rows[0];
      inMemoryEvents.unshift(created);
      return formatEventResponse(created);
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
          schedule: data.schedule || data.sessions || [],
          speakers: data.speakers || [],
          chief_guests: chiefGuests,
          faqs: data.faqs || [],
          volunteers: data.volunteers || [],
          registration_settings: data.registrationSettings || {},
          accessibility_features: data.accessibilityFeatures || {},
          contact_and_emergency: data.contactAndEmergency || {},
          media_attachments: data.mediaAttachments || {},
          merchant_account: data.merchantAccount || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryEvents.unshift(devEvent);
        return formatEventResponse(devEvent);
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
    orgId?: string;
    wheelchairOnly?: boolean;
    search?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    try {
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
      } else if (!params.orgId) {
        // Public feeds hide pending_verification and rejected events
        conditions.push(`status IN ('published', 'upcoming', 'ongoing')`);
      }
      if (params.orgId) {
        conditions.push(`org_id = $${idx++}`);
        values.push(params.orgId);
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
        `SELECT e.*, o.name as org_name, o.logo_url as org_logo, o.website as org_website
         FROM events e
         JOIN organizations o ON e.org_id = o.id
         ${whereClause}
         ORDER BY e.event_date ASC, e.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      const formattedRows = eventsRes.rows.map(r => formatEventResponse(r));
      return buildPaginatedResult(formattedRows, total, page, limit);
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
        const formatted = filtered.map(e => formatEventResponse(e));
        return buildPaginatedResult(formatted, formatted.length, page, limit);
      }
      throw err;
    }
  }

  static async getEventById(id: string) {
    try {
      const res = await query(
        `SELECT e.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about, o.website as org_website
         FROM events e
         JOIN organizations o ON e.org_id = o.id
         WHERE e.id = $1`,
        [id]
      );
      return res.rows[0] ? formatEventResponse(res.rows[0]) : null;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const found = inMemoryEvents.find((e: any) => String(e.id) === String(id));
        return found ? formatEventResponse(found) : null;
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
      'district', 'state', 'google_maps_link', 'meeting_platform', 'meeting_link',
      'wheelchair_accessible', 'sign_language', 'braille_material', 'capacity', 'is_free',
      'ticket_price', 'status', 'is_verified', 'eligibility', 'sponsors', 'gallery', 'contact_email',
      'schedule', 'speakers', 'chief_guests', 'faqs', 'volunteers', 'registration_settings',
      'accessibility_features', 'contact_and_emergency', 'media_attachments', 'merchant_account',
      'landmark', 'pincode', 'meeting_passcode'
    ];

    const jsonbFields = [
      'schedule', 'speakers', 'faqs', 'volunteers', 'sponsors',
      'registration_settings', 'accessibility_features', 'contact_and_emergency',
      'media_attachments', 'merchant_account'
    ];

    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      const val = data[camel] !== undefined ? data[camel] : data[key];
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        if (jsonbFields.includes(key)) {
          values.push(typeof val === 'string' ? val : JSON.stringify(val));
        } else {
          values.push(val);
        }
      }
    }

    if (fields.length === 0) return this.getEventById(id);

    fields.push('updated_at = NOW()');

    try {
      const res = await query(
        `UPDATE events SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );

      return formatEventResponse(res.rows[0]);
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const ev = inMemoryEvents.find((e: any) => String(e.id) === String(id));
        if (ev) {
          Object.assign(ev, data, { updated_at: new Date().toISOString() });
          return formatEventResponse(ev);
        }
      }
      throw err;
    }
  }

  static async deleteEvent(id: string) {
    try {
      await query(`DELETE FROM events WHERE id = $1`, [id]);
      return { success: true };
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const idx = inMemoryEvents.findIndex((e: any) => String(e.id) === String(id));
        if (idx !== -1) inMemoryEvents.splice(idx, 1);
        return { success: true };
      }
      throw err;
    }
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
      `SELECT e.*, o.name as org_name, o.logo_url as org_logo, o.website as org_website
       FROM events e
       JOIN organizations o ON e.org_id = o.id
       WHERE e.id != $1 AND (e.category = $2 OR e.type = $3) AND e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC
       LIMIT 4`,
      [eventId, currentEvent.category, currentEvent.type]
    );

    return res.rows.map(r => formatEventResponse(r));
  }
}
