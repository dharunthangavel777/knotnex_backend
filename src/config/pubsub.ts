import { PubSub } from '@google-cloud/pubsub';
import { config } from './index';
import { logger } from './logger';

export const pubsub = new PubSub({
  projectId: config.pubsub.projectId,
});

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

logger.info('Google Cloud Pub/Sub client configured', { projectId: config.pubsub.projectId });
