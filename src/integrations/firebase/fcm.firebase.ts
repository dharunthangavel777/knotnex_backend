import { messaging } from '../../config/firebase';
import { logger } from '../../config/logger';

export interface SendPushOptions {
  imageUrl?: string;
  priority?: 'normal' | 'high' | 'urgent';
}

export class FcmIntegration {
  static async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    dataPayload?: Record<string, string>,
    options?: SendPushOptions
  ) {
    if (!fcmToken) return;

    try {
      const isUrgent = options?.priority === 'high' || options?.priority === 'urgent';
      const notificationPayload: any = {
        title,
        body,
      };
      if (options?.imageUrl) {
        notificationPayload.imageUrl = options.imageUrl;
      }

      const response = await messaging.send({
        token: fcmToken,
        notification: notificationPayload,
        data: dataPayload,
        android: {
          priority: isUrgent ? 'high' : 'normal',
          notification: {
            sound: 'default',
            channelId: 'knotnex_high_importance_channel',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            imageUrl: options?.imageUrl,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
          fcmOptions: options?.imageUrl ? { imageUrl: options.imageUrl } : undefined,
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
    dataPayload?: Record<string, string>,
    options?: SendPushOptions
  ) {
    if (!fcmTokens || fcmTokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const isUrgent = options?.priority === 'high' || options?.priority === 'urgent';
    const notificationPayload: any = { title, body };
    if (options?.imageUrl) {
      notificationPayload.imageUrl = options.imageUrl;
    }

    // Chunk tokens into batches of 500 (FCM sendEachForMulticast max limit)
    const CHUNK_SIZE = 500;
    let totalSuccess = 0;
    let totalFailure = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < fcmTokens.length; i += CHUNK_SIZE) {
      const chunk = fcmTokens.slice(i, i + CHUNK_SIZE);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: notificationPayload,
          data: dataPayload,
          android: {
            priority: isUrgent ? 'high' : 'normal',
            notification: {
              sound: 'default',
              channelId: 'knotnex_high_importance_channel',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              imageUrl: options?.imageUrl,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
            fcmOptions: options?.imageUrl ? { imageUrl: options.imageUrl } : undefined,
          },
        });

        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        // Collect unregistered or invalid tokens
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-registration-token'
            ) {
              invalidTokens.push(chunk[idx]);
            }
          }
        });
      } catch (err: any) {
        logger.error('[FcmIntegration.sendMulticast] Batch error: ' + err.message);
        totalFailure += chunk.length;
      }
    }

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      invalidTokens,
    };
  }
}
