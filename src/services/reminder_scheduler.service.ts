import { query } from '../config/database';
import { logger } from '../config/logger';
import { NotificationService } from './notification.service';

/**
 * Scheduled background reminder service for time-sensitive events and scheme deadlines.
 * Runs on a periodic timer (every 15 minutes) inside the KnotNex backend process.
 */
export class ReminderSchedulerService {
  private static intervalHandle: NodeJS.Timeout | null = null;
  private static isRunning: boolean = false;

  /**
   * Initializes the scheduled background checker.
   * Runs check immediately on boot, then every 15 minutes.
   */
  static startScheduler(intervalMs: number = 15 * 60 * 1000) {
    logger.info('⏰ KnotNex Notification Reminder Scheduler initialized (interval: 15m)');
    
    // Initial check 30s after startup
    setTimeout(() => {
      this.checkAndDispatchReminders().catch((err) => {
        logger.warn('[ReminderScheduler] Initial check error: ' + err.message);
      });
    }, 30000);

    // Periodic check
    this.intervalHandle = setInterval(() => {
      this.checkAndDispatchReminders().catch((err) => {
        logger.warn('[ReminderScheduler] Periodic check error: ' + err.message);
      });
    }, intervalMs);
  }

  static stopScheduler() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('⏰ KnotNex Notification Reminder Scheduler stopped');
    }
  }

  /**
   * Main scan routine for 24h, 2h event reminders and scheme deadlines.
   */
  static async checkAndDispatchReminders() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.process24HourEventReminders();
      await this.process2HourEventReminders();
      await this.processSchemeDeadlineReminders();
    } catch (error: any) {
      logger.warn('[ReminderScheduler] Scan cycle error: ' + error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 1. 24-Hour Event Reminder (EVT_008)
   * Target: Attendees registered for events starting between 23h and 25h from now.
   */
  private static async process24HourEventReminders() {
    try {
      const res = await query(
        `SELECT r.id as registration_id, r.user_id, e.id as event_id, e.title as event_title, e.event_date
         FROM event_registrations r
         JOIN events e ON r.event_id = e.id
         WHERE r.status = 'confirmed'
           AND e.status = 'published'
           AND e.event_date BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
           AND NOT EXISTS (
             SELECT 1 FROM notifications n 
             WHERE n.user_id = r.user_id 
               AND n.data->>'reminder' = '24h' 
               AND n.data->>'eventId' = e.id::text
           )`
      );

      for (const row of res.rows) {
        const timeStr = new Date(row.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await NotificationService.createNotification(
          row.user_id,
          null,
          'event',
          `Reminder: "${row.event_title}" is Tomorrow! ⏰`,
          `Starts tomorrow at ${timeStr}. Have your entry QR pass ready!`,
          {
            type: 'event',
            eventId: row.event_id,
            reminder: '24h',
            registrationId: row.registration_id,
          }
        ).catch(() => {});
      }

      if (res.rowCount && res.rowCount > 0) {
        logger.info(`[ReminderScheduler] Dispatched ${res.rowCount} 24-hour event reminders`);
      }
    } catch (e: any) {
      logger.warn('[ReminderScheduler.24h] Notice: ' + e.message);
    }
  }

  /**
   * 2. 2-Hour Event Reminder (EVT_009)
   * Target: Attendees registered for events starting between 1.5h and 2.5h from now who haven't checked in yet.
   */
  private static async process2HourEventReminders() {
    try {
      const res = await query(
        `SELECT r.id as registration_id, r.user_id, e.id as event_id, e.title as event_title, e.venue
         FROM event_registrations r
         JOIN events e ON r.event_id = e.id
         WHERE r.status = 'confirmed'
           AND (r.check_in_status IS NULL OR r.check_in_status = FALSE)
           AND e.status = 'published'
           AND e.event_date BETWEEN NOW() + INTERVAL '1 hour 30 minutes' AND NOW() + INTERVAL '2 hours 30 minutes'
           AND NOT EXISTS (
             SELECT 1 FROM notifications n 
             WHERE n.user_id = r.user_id 
               AND n.data->>'reminder' = '2h' 
               AND n.data->>'eventId' = e.id::text
           )`
      );

      for (const row of res.rows) {
        const venue = row.venue || 'the venue';
        await NotificationService.createNotification(
          row.user_id,
          null,
          'event',
          `Starting in 2 Hours: "${row.event_title}"`,
          `Head over to ${venue}. Gates are open for check-in!`,
          {
            type: 'event',
            eventId: row.event_id,
            reminder: '2h',
            registrationId: row.registration_id,
          }
        ).catch(() => {});
      }

      if (res.rowCount && res.rowCount > 0) {
        logger.info(`[ReminderScheduler] Dispatched ${res.rowCount} 2-hour event reminders`);
      }
    } catch (e: any) {
      logger.warn('[ReminderScheduler.2h] Notice: ' + e.message);
    }
  }

  /**
   * 3. Scheme Deadline Reminder (SCH_008)
   * Target: Users who saved a scheme whose deadline expires in 48 hours.
   */
  private static async processSchemeDeadlineReminders() {
    try {
      const res = await query(
        `SELECT si.user_id, s.id as scheme_id, s.title as scheme_title
         FROM saved_items si
         JOIN schemes s ON si.item_id = s.id
         WHERE s.status = 'published'
           AND s.deadline BETWEEN NOW() + INTERVAL '47 hours' AND NOW() + INTERVAL '49 hours'
           AND NOT EXISTS (
             SELECT 1 FROM notifications n 
             WHERE n.user_id = si.user_id 
               AND n.data->>'reminder' = 'scheme_deadline' 
               AND n.data->>'schemeId' = s.id::text
           )`
      );

      for (const row of res.rows) {
        await NotificationService.createNotification(
          row.user_id,
          null,
          'scheme',
          `Deadline Approaching: "${row.scheme_title}" ⏳`,
          `Applications for this scheme close in 48 hours. Submit your documents before the deadline!`,
          {
            type: 'scheme',
            schemeId: row.scheme_id,
            reminder: 'scheme_deadline',
          }
        ).catch(() => {});
      }

      if (res.rowCount && res.rowCount > 0) {
        logger.info(`[ReminderScheduler] Dispatched ${res.rowCount} scheme deadline reminders`);
      }
    } catch (e: any) {
      // saved_items table check
    }
  }
}

