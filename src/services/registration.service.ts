import { query } from '../config/database';
import { QrGenerator } from '../integrations/qr/qr-generator';
import { PubSubIntegration } from '../integrations/gcp/pubsub.gcp';
import { EmailService } from '../integrations/email/email.service';
import { TOPICS } from '../config/pubsub';
import { RegistrationStatus } from '../types/enums';
import { NotificationService } from './notification.service';
import crypto from 'crypto';

export class RegistrationService {
  static async registerForEvent(userId: string, data: any) {
    const eventId = data.eventId || data.event_id;
    if (!eventId) {
      throw new Error('Event ID is required');
    }

    // Check if already registered
    const existing = await query(
      `SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error('You are already registered for this event');
    }

    const personalInfo = data.personalInfo || {
      fullName: data.fullName || data.full_name || 'Participant',
      email: data.email || 'participant@knotnex.com',
      phone: data.phone || '+919876543210',
    };
    const accessibilityNeeds = data.accessibilityNeeds || data.accessibility_needs || {};
    const consentGiven = data.consentGiven !== undefined ? data.consentGiven : (data.consent_given !== undefined ? data.consent_given : true);

    // Generate secure QR hash
    const qrCodeHash = crypto.createHash('sha256').update(`${userId}-${eventId}-${Date.now()}`).digest('hex');

    // Generate QR pass payload
    const qrPayload = JSON.stringify({
      knotnexTicket: true,
      qrHash: qrCodeHash,
      eventId,
      userId,
    });

    const qrPassDataUrl = await QrGenerator.generateDataUrl(qrPayload);

    // Insert into PostgreSQL
    const res = await query(
      `INSERT INTO event_registrations (
        event_id, user_id, status, qr_code_hash, qr_pass_url, personal_info, accessibility_needs, consent_given
      ) VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        eventId,
        userId,
        qrCodeHash,
        qrPassDataUrl,
        JSON.stringify(personalInfo),
        JSON.stringify(accessibilityNeeds),
        consentGiven,
      ]
    );

    const registration = res.rows[0];

    // Increment registered_count on events table
    await query(
      `UPDATE events SET registered_count = registered_count + 1 WHERE id = $1`,
      [eventId]
    );

    // Fetch event details for confirmation email & notification
    const eventRes = await query(`SELECT title FROM events WHERE id = $1`, [eventId]);
    const eventTitle = eventRes.rows[0]?.title || 'Knotnex Event';

    // In-app notification
    NotificationService.createNotification(
      userId,
      null,
      'event',
      'Event Registration Confirmed',
      `You are successfully registered for "${eventTitle}". Your entry QR pass is ready!`,
      { eventId, registrationId: registration.id }
    ).catch(() => {});

    // Dispatch Pub/Sub event
    PubSubIntegration.publishMessage(TOPICS.EVENT_REGISTRATION, {
      registrationId: registration.id,
      eventId,
      userId,
      userEmail: personalInfo.email,
    });

    // Send confirmation email async
    if (personalInfo.email) {
      EmailService.sendEventRegistrationConfirmation(
        personalInfo.email,
        eventTitle,
        qrPassDataUrl
      ).catch(() => {});
    }

    return registration;
  }

  static async listRegistrationsByEvent(eventId: string) {
    const res = await query(
      `SELECT r.*, u.full_name as user_name, u.avatar_url as user_avatar
       FROM event_registrations r
       JOIN users u ON r.user_id = u.id
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC`,
      [eventId]
    );
    return res.rows;
  }

  static async listRegistrationsByUser(userId: string) {
    const res = await query(
      `SELECT r.*, e.title as event_title, e.event_date, e.start_time, e.venue_name, e.type as event_type, e.cover_url
       FROM event_registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return res.rows;
  }

  static async getRegistrationById(id: string) {
    const res = await query(
      `SELECT r.*, e.title as event_title, e.event_date, e.start_time, e.venue_name, e.type as event_type, e.cover_url
       FROM event_registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async updateStatus(id: string, status: RegistrationStatus) {
    const res = await query(
      `UPDATE event_registrations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0];
  }

  static async checkInByQr(qrCodeHash: string) {
    const res = await query(
      `SELECT r.*, u.full_name, u.email, e.title as event_title
       FROM event_registrations r
       JOIN users u ON r.user_id = u.id
       JOIN events e ON r.event_id = e.id
       WHERE r.qr_code_hash = $1`,
      [qrCodeHash]
    );

    if (!res.rows[0]) {
      throw new Error('Invalid QR Code. No matching registration found.');
    }

    const reg = res.rows[0];

    if (reg.checked_in_at) {
      return {
        alreadyCheckedIn: true,
        checkedInAt: reg.checked_in_at,
        attendee: reg.full_name,
        event: reg.event_title,
      };
    }

    await query(
      `UPDATE event_registrations SET checked_in_at = NOW(), status = 'attended', updated_at = NOW() WHERE id = $1`,
      [reg.id]
    );

    return {
      alreadyCheckedIn: false,
      checkedInAt: new Date(),
      attendee: reg.full_name,
      event: reg.event_title,
    };
  }

  static async getQrPass(registrationId: string, userId?: string) {
    const res = await query(
      `SELECT qr_pass_url, qr_code_hash, status FROM event_registrations WHERE id = $1 ${userId ? 'AND user_id = $2' : ''}`,
      userId ? [registrationId, userId] : [registrationId]
    );
    return res.rows[0] || null;
  }
}
