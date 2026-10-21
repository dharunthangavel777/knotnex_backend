// ─── Google Cloud Pub/Sub — Disabled ─────────────────────────────────────────
// Pub/Sub has been removed from this architecture to reduce cost.
// PubSubIntegration.publishMessage() is a no-op; events are not queued.
//
// To re-enable: install @google-cloud/pubsub, restore the real implementation,
// and set PUBSUB_PROJECT_ID in your environment.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '../../config/logger';

export class PubSubIntegration {
  static async publishMessage(topicName: string, data: Record<string, any>): Promise<string> {
    logger.debug(`[PubSub] Skipped (disabled): topic=${topicName}`, { data });
    return 'pubsub_disabled';
  }
}
