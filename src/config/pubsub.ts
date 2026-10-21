// ─── Google Cloud Pub/Sub Config — Disabled ───────────────────────────────────
// Pub/Sub has been removed from this architecture. This file is a stub only.
// ─────────────────────────────────────────────────────────────────────────────

export const TOPICS = {
  USER_REGISTERED: 'user.registered',
  EVENT_REGISTRATION: 'event.registration',
  EVENT_REMINDER: 'event.reminder',
  JOB_APPLIED: 'job.applied',
  JOB_STAGE_CHANGED: 'job.stage-changed',
  TICKET_CREATED: 'ticket.created',
  TICKET_REPLIED: 'ticket.replied',
  POST_REPORTED: 'post.reported',
  ANALYTICS_EVENT: 'analytics.event',
} as const;
