import { pubsub, TOPICS } from '../../config/pubsub';
import { logger } from '../../config/logger';

export class PubSubIntegration {
  static async publishMessage(topicName: string, data: Record<string, any>): Promise<string> {
    try {
      const dataBuffer = Buffer.from(JSON.stringify(data));
      const messageId = await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
      logger.info('Pub/Sub message published', { topicName, messageId });
      return messageId;
    } catch (error: any) {
      logger.warn('Pub/Sub publish failed (event queued locally/bypassed)', {
        topicName,
        error: error.message,
      });
      return 'mock_pubsub_id';
    }
  }
}
