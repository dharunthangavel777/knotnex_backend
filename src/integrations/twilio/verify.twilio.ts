import twilio from 'twilio';
import { config } from '../../config';
import { logger } from '../../config/logger';

let twilioClient: any = null;

if (config.twilio.accountSid && config.twilio.authToken) {
  twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
}

export class TwilioVerifyIntegration {
  static async sendOtp(phone: string) {
    if (!twilioClient || !config.twilio.verifyServiceSid) {
      logger.warn('Twilio Verify service not configured. Mocking OTP verification.');
      return { status: 'pending', mock: true, code: '123456' };
    }

    try {
      const verification = await twilioClient.verify.v2
        .services(config.twilio.verifyServiceSid)
        .verifications.create({ to: phone, channel: 'sms' });

      return verification;
    } catch (error: any) {
      logger.error('Twilio Verify send OTP error', { error: error.message, phone });
      throw error;
    }
  }

  static async checkOtp(phone: string, code: string) {
    if (!twilioClient || !config.twilio.verifyServiceSid) {
      // Allow '123456' in dev/mock mode
      return { status: code === '123456' ? 'approved' : 'rejected', mock: true };
    }

    try {
      const check = await twilioClient.verify.v2
        .services(config.twilio.verifyServiceSid)
        .verificationChecks.create({ to: phone, code });

      return check;
    } catch (error: any) {
      logger.error('Twilio Verify check OTP error', { error: error.message, phone });
      throw error;
    }
  }
}
