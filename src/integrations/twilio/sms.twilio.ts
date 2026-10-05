import twilio from 'twilio';
import { config } from '../../config';
import { logger } from '../../config/logger';

let twilioClient: any = null;

if (config.twilio.accountSid && config.twilio.authToken) {
  twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
}

export class TwilioSmsIntegration {
  static async sendSms(to: string, message: string) {
    if (!twilioClient) {
      logger.warn('Twilio credentials not configured. SMS skipped.', { to, message });
      return { sid: 'mock_sms_sid' };
    }

    try {
      const response = await twilioClient.messages.create({
        body: message,
        from: config.twilio.phoneNumber,
        to,
      });
      logger.info('Twilio SMS sent', { sid: response.sid, to });
      return response;
    } catch (error: any) {
      logger.error('Twilio SMS error', { error: error.message, to });
      throw error;
    }
  }
}
