import { query } from '../config/database';
import { auth as firebaseAuth } from '../config/firebase';
import { FirebaseAuthIntegration } from '../integrations/firebase/auth.firebase';
import { TwilioVerifyIntegration } from '../integrations/twilio/verify.twilio';
import { EmailService } from '../integrations/email/email.service';
import { PubSubIntegration } from '../integrations/gcp/pubsub.gcp';
import { TOPICS } from '../config/pubsub';
import { UserRole } from '../types/enums';
import { logger } from '../config/logger';

export class AuthService {
  static async signup(data: {
    firebaseUid: string;
    email: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
    avatarUrl?: string;
  }) {
    const role = data.role || UserRole.USER;

    // Insert user into PostgreSQL
    const res = await query(
      `INSERT INTO users (firebase_uid, email, full_name, phone, role, avatar_url, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (firebase_uid) DO UPDATE 
         SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW()
       RETURNING id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, created_at`,
      [data.firebaseUid, data.email, data.fullName, data.phone || null, role, data.avatarUrl || null, true]
    );

    const user = res.rows[0];

    // Create empty profile entry
    await query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Set custom claims in Firebase
    await FirebaseAuthIntegration.setCustomUserClaims(data.firebaseUid, {
      role,
      isVerified: true,
    });

    // Publish event
    await PubSubIntegration.publishMessage(TOPICS.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    });

    // Send welcome email async
    EmailService.sendWelcomeEmail(user.email, user.full_name).catch(() => {});

    return user;
  }

  static async sendOtp(phone: string) {
    return await TwilioVerifyIntegration.sendOtp(phone);
  }

  static async verifyOtp(phone: string, code: string) {
    return await TwilioVerifyIntegration.checkOtp(phone, code);
  }

  static async forgotPassword(email: string) {
    try {
      const link = await firebaseAuth.generatePasswordResetLink(email);
      await EmailService.sendEmail(
        email,
        'Knotnex Password Reset',
        `<p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p>`
      );
      return { message: 'Password reset link sent' };
    } catch (error: any) {
      logger.error('Forgot password error', { email, error: error.message });
      throw error;
    }
  }

  static async registerLoginDevice(userId: string, deviceInfo: {
    deviceName?: string;
    deviceType?: string;
    os?: string;
    browser?: string;
    ipAddress?: string;
  }) {
    await query(
      `INSERT INTO user_devices (user_id, device_name, device_type, os, browser, ip_address, last_active_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        userId,
        deviceInfo.deviceName || 'Unknown',
        deviceInfo.deviceType || 'mobile',
        deviceInfo.os || 'Unknown',
        deviceInfo.browser || 'App',
        deviceInfo.ipAddress || null,
      ]
    );
  }
}
