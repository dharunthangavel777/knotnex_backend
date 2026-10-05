import { messaging } from '../../config/firebase';
import { logger } from '../../config/logger';

export class FcmIntegration {
  static async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    dataPayload?: Record<string, string>
  ) {
    if (!fcmToken) return;

    try {
      const response = await messaging.send({
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: dataPayload,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
      logger.info('FCM push notification sent successfully', { messageId: response });
      return response;
    } catch (error: any) {
      logger.error('Failed to send FCM notification', { token: fcmToken, error: error.message });
      throw error;
    }
  }

  static async sendMulticast(
    fcmTokens: string[],
    title: string,
    body: string,
    dataPayload?: Record<string, string>
  ) {
    if (!fcmTokens || fcmTokens.length === 0) return;

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
        data: dataPayload,
      });
      logger.info('FCM multicast notification sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
      return response;
    } catch (error: any) {
      logger.error('Failed to send multicast FCM notification', { error: error.message });
      throw error;
    }
  }
}
