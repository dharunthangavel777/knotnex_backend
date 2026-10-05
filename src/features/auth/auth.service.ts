import { query } from '../../config/database';
import { auth as firebaseAuth } from '../../config/firebase';
import { FirebaseAuthIntegration } from '../../integrations/firebase/auth.firebase';
import { EmailService } from '../../integrations/email/email.service';
import { createOtp, verifyOtp } from '../../shared/utils/otp.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  isRefreshTokenValid,
  revokeAllRefreshTokensForUser,
  signRegistrationToken,
  verifyRegistrationToken,
  signResetToken,
  verifyResetToken,
} from '../../shared/utils/jwt.util';
import { UserRole } from '../../types/enums';
import { logger } from '../../config/logger';
import bcrypt from 'bcryptjs';
import type { AuthResponse, AuthTokens, AuthUser, InitiateSignupData } from './auth.types';

// ─── Helper: build token pair ────────────────────────────────────────────────

async function buildTokens(user: AuthUser): Promise<AuthTokens> {
  const { token: refreshToken } = await signRefreshToken(user.id);
  const accessToken = signAccessToken({
    sub: user.id,
    uid: user.firebaseUid,
    email: user.email,
    role: user.role,
  });
  return { accessToken, refreshToken, expiresIn: 15 * 60 }; // 15 min
}

// ─── Helper: map DB row to AuthUser ─────────────────────────────────────────

function rowToAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role as UserRole,
    isVerified: row.is_verified,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

// ============================================================================
//  AUTH SERVICE
// ============================================================================

export class AuthService {

  // ─── STEP 1: Initiate Signup ─────────────────────────────────────────────

  /**
   * Validates email uniqueness, creates 4-digit OTP in Redis,
   * and sends it to the user's email via Brevo.
   */
  static async initiateSignup(data: InitiateSignupData) {
    const email = data.email.toLowerCase().trim();

    // Check if email already registered
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    const otp = await createOtp(email, 'SIGNUP');

    // Send OTP email (Brevo)
    await EmailService.sendOtpEmail(email, data.fullName, otp, 'signup');

    logger.info(`[AuthService] Signup OTP dispatched to ${email}`);
    return {
      message: 'Verification code sent to your email. Please check your inbox.',
      expiresIn: 600,
      email,
      debugOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  // ─── STEP 2: Verify Signup OTP ───────────────────────────────────────────

  /**
   * Verifies the 4-digit OTP. On success, issues a short-lived
   * registration JWT so the client can proceed to create the Firebase account.
   */
  static async verifySignupOtp(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase().trim();

    await verifyOtp(normalizedEmail, 'SIGNUP', otp);

    // Issue a registration token valid for 15 minutes
    // Note: fullName / phone captured at initiateSignup but NOT stored here yet.
    // The client must resend them in completeSignup via the registrationToken payload.
    const registrationToken = signRegistrationToken({
      email: normalizedEmail,
      fullName: '', // will be filled in completeSignup via Firebase profile
    });

    return {
      message: 'Email verified successfully.',
      registrationToken,
    };
  }

  // ─── STEP 3: Complete Signup ─────────────────────────────────────────────

  /**
   * Verifies the Firebase ID token (user already created account client-side),
   * creates user record in PostgreSQL, sets Firebase custom claims,
   * issues JWT access + refresh tokens.
   */
  static async completeSignup(
    registrationToken: string,
    firebaseIdToken?: string,
    password?: string,
    providedFullName?: string,
    providedPhone?: string
  ): Promise<AuthResponse> {
    // Validate registration token
    let regPayload: any;
    try {
      regPayload = verifyRegistrationToken(registrationToken);
    } catch (err: any) {
      throw new Error('Registration session expired. Please start over.');
    }

    let firebaseUid: string;
    let email: string = regPayload.email;
    let fullName: string =
      (providedFullName && providedFullName.trim()) ||
      (regPayload.fullName && regPayload.fullName.trim()) ||
      '';
    let phone: string | null = (providedPhone && providedPhone.trim()) || null;
    let avatarUrl: string | null = null;

    if (firebaseIdToken) {
      try {
        const decoded = await FirebaseAuthIntegration.verifyToken(firebaseIdToken);
        firebaseUid = decoded.uid;
        if (decoded.email) email = decoded.email.toLowerCase();
        if (decoded.name && !fullName) fullName = decoded.name;
        if (decoded.picture) avatarUrl = decoded.picture;
      } catch (err: any) {
        logger.warn(`[AuthService] Firebase token verification skipped/failed: ${err.message}. Using token session.`);
        firebaseUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
    } else {
      firebaseUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    if (!fullName || fullName === 'Knotnex User') {
      const emailPrefix = email.split('@')[0];
      fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Upsert user in PostgreSQL with password_hash
    const res = await query(
      `INSERT INTO users (firebase_uid, email, full_name, phone, role, avatar_url, is_verified, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             phone = COALESCE(EXCLUDED.phone, users.phone),
             firebase_uid = EXCLUDED.firebase_uid,
             is_verified = true,
             password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
             updated_at = NOW()
       RETURNING id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, created_at`,
      [firebaseUid, email, fullName, phone, UserRole.USER, avatarUrl, true, passwordHash]
    );

    const user = rowToAuthUser(res.rows[0]);

    // Create empty user_profiles entry
    await query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Set Firebase custom claims
    if (!firebaseUid.startsWith('user_')) {
      await FirebaseAuthIntegration.setCustomUserClaims(firebaseUid, {
        role: user.role,
        isVerified: true,
      }).catch(() => {});
    }

    // Issue JWT tokens
    const tokens = await buildTokens(user);

    // Send welcome email asynchronously
    EmailService.sendWelcomeEmail(user.email, user.fullName).catch((err) => {
      logger.warn(`[AuthService] Welcome email failed for ${user.email}: ${err.message}`);
    });

    logger.info(`[AuthService] New user registered: ${user.email} (id: ${user.id})`);

    return { user, tokens };
  }

  // ─── Direct Signup ────────────────────────────────────────────────────────
  static async directSignup(data: {
    email: string;
    password?: string;
    fullName: string;
    phone?: string;
    role?: string;
  }): Promise<AuthResponse> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const rawRole = (data.role || '').toLowerCase();
    const role = (rawRole === 'organization' || rawRole === 'ngo')
      ? UserRole.ORGANIZATION
      : (rawRole === 'admin' ? UserRole.ADMIN : UserRole.USER);

    // Check duplicate account
    const existing = await query(`SELECT id FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error('An account with this email already exists.');
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const firebaseUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const res = await query(
      `INSERT INTO users (firebase_uid, email, full_name, phone, role, password_hash, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, created_at`,
      [firebaseUid, normalizedEmail, data.fullName, data.phone || null, role, passwordHash]
    );

    const user = rowToAuthUser(res.rows[0]);
    await query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    const tokens = await buildTokens(user);
    logger.info(`[AuthService] Direct signup completed: ${user.email} (id: ${user.id})`);
    return { user, tokens };
  }

  // ─── Sign In ─────────────────────────────────────────────────────────────

  /**
   * Verifies Firebase ID token OR email/password credentials, issues JWT tokens.
   */
  static async signin(credentials: { firebaseIdToken?: string; email?: string; password?: string } | string): Promise<AuthResponse> {
    const token = typeof credentials === 'string' ? credentials : credentials?.firebaseIdToken;
    const email = typeof credentials === 'object' ? credentials?.email : undefined;
    const password = typeof credentials === 'object' ? credentials?.password : undefined;

    if (token) {
      let decoded;
      try {
        decoded = await FirebaseAuthIntegration.verifyToken(token);
      } catch (err: any) {
        throw new Error('Invalid or expired Firebase token. Please sign in again.');
      }

      const res = await query(
        `SELECT id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, is_banned
         FROM users WHERE firebase_uid = $1 LIMIT 1`,
        [decoded.uid]
      );

      if (!res.rowCount || res.rowCount === 0) {
        throw new Error('Account not found. Please sign up first.');
      }

      const dbUser = res.rows[0];

      if (dbUser.is_banned) {
        throw new Error('Your account has been suspended. Please contact support.');
      }

      const user = rowToAuthUser(dbUser);
      const tokens = await buildTokens(user);

      logger.info(`[AuthService] User signed in via Firebase: ${user.email} (id: ${user.id})`);
      return { user, tokens };
    }

    if (email && password) {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await query(
        `SELECT id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, is_banned, password_hash
         FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [normalizedEmail]
      );

      if (!res.rowCount || res.rowCount === 0) {
        throw new Error('Invalid email or password.');
      }

      const dbUser = res.rows[0];

      if (dbUser.is_banned) {
        throw new Error('Your account has been suspended. Please contact support.');
      }

      if (!dbUser.password_hash) {
        throw new Error('Invalid email or password.');
      }

      const match = await bcrypt.compare(password, dbUser.password_hash);
      if (!match) {
        throw new Error('Invalid email or password.');
      }

      const user = rowToAuthUser(dbUser);
      const tokens = await buildTokens(user);

      logger.info(`[AuthService] User signed in via Email/Password: ${user.email} (id: ${user.id})`);
      return { user, tokens };
    }

    throw new Error('Either firebaseIdToken or email and password must be provided.');
  }

  // ─── Refresh Tokens ───────────────────────────────────────────────────────

  /**
   * Validates a refresh token, rotates it (revoke old, issue new pair).
   */
  static async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err: any) {
      throw new Error('Invalid or expired refresh token. Please sign in again.');
    }

    // Check Redis (revocation check)
    const valid = await isRefreshTokenValid(payload.jti);
    if (!valid) {
      throw new Error('Refresh token has been revoked. Please sign in again.');
    }

    // Look up user
    const res = await query(
      `SELECT id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, is_banned
       FROM users WHERE id = $1 LIMIT 1`,
      [payload.sub]
    );

    if (!res.rowCount || res.rowCount === 0) {
      throw new Error('User not found.');
    }

    const dbUser = res.rows[0];
    if (dbUser.is_banned) {
      throw new Error('Your account has been suspended.');
    }

    // Revoke old refresh token
    await revokeRefreshToken(payload.jti);

    const user = rowToAuthUser(dbUser);
    const tokens = await buildTokens(user);

    return { user, tokens };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * Revokes the user's refresh token from Redis.
   * Access token expires naturally.
   */
  static async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = verifyRefreshToken(refreshToken);
      await revokeRefreshToken(payload.jti);
      logger.info(`[AuthService] Refresh token revoked (jti: ${payload.jti})`);
    } catch {
      // Token may be expired already — no-op
    }
  }

  // ─── Forgot Password — Step 1: Send Reset OTP ────────────────────────────

  static async forgotPassword(email: string) {
    const normalized = email.toLowerCase().trim();

    // Check email exists (but don't reveal if it doesn't for security)
    const res = await query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalized]
    );

    // Always return success (prevents email enumeration)
    if (!res.rowCount || res.rowCount === 0) {
      logger.warn(`[AuthService] Forgot password for unknown email: ${normalized}`);
      return {
        message: 'If this email is registered, you will receive a reset code shortly.',
        expiresIn: 900,
      };
    }

    const otp = await createOtp(normalized, 'PASSWORD_RESET');
    await EmailService.sendOtpEmail(normalized, '', otp, 'reset');

    logger.info(`[AuthService] Password reset OTP dispatched to ${normalized}`);
    return {
      message: 'Password reset code sent to your email.',
      expiresIn: 900,
      debugOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  // ─── Forgot Password — Step 2: Verify Reset OTP ──────────────────────────

  static async verifyForgotOtp(email: string, otp: string) {
    const normalized = email.toLowerCase().trim();

    await verifyOtp(normalized, 'PASSWORD_RESET', otp);

    // Look up user for reset token
    const res = await query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalized]
    );

    if (!res.rowCount || res.rowCount === 0) {
      throw new Error('User not found.');
    }

    const userId = res.rows[0].id;

    const resetToken = signResetToken({ email: normalized, userId });

    return {
      message: 'OTP verified. You can now reset your password.',
      resetToken,
    };
  }

  // ─── Forgot Password — Step 3: Reset Password ────────────────────────────

  /**
   * Uses the reset token to update the user's password via Firebase Admin SDK.
   * Revokes all existing refresh tokens for the user.
   */
  static async resetPassword(resetToken: string, newPassword: string) {
    let payload;
    try {
      payload = verifyResetToken(resetToken);
    } catch (err: any) {
      throw new Error('Reset session expired. Please start over.');
    }

    // Get firebase_uid from DB
    const res = await query(
      'SELECT firebase_uid FROM users WHERE id = $1 LIMIT 1',
      [payload.userId]
    );

    if (!res.rowCount || res.rowCount === 0) {
      throw new Error('User not found.');
    }

    const { firebase_uid } = res.rows[0];

    // Update password_hash in PostgreSQL
    const newHash = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, payload.userId]
    );

    // Update password in Firebase (if real Firebase user)
    try {
      if (!firebase_uid.startsWith('user_') && !firebase_uid.startsWith('mock_')) {
        await firebaseAuth.updateUser(firebase_uid, { password: newPassword });
      }
    } catch (e: any) {
      logger.warn(`[AuthService] Firebase password update skipped/failed: ${e.message}`);
    }

    // Revoke all refresh tokens
    await revokeAllRefreshTokensForUser(payload.userId);

    logger.info(`[AuthService] Password reset for user ${payload.email}`);

    return { message: 'Password reset successfully. Please sign in with your new password.' };
  }

  // ─── Get Me ───────────────────────────────────────────────────────────────

  static async getMe(userId: string): Promise<AuthUser> {
    const res = await query(
      `SELECT id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!res.rowCount || res.rowCount === 0) {
      throw new Error('User not found.');
    }

    return rowToAuthUser(res.rows[0]);
  }

  // ─── Register Login Device (optional tracking) ───────────────────────────

  static async registerLoginDevice(userId: string, deviceInfo: {
    deviceName?: string;
    deviceType?: string;
    os?: string;
    browser?: string;
    ipAddress?: string;
  }) {
    try {
      await query(
        `INSERT INTO user_devices (user_id, device_name, device_type, os, browser, ip_address, last_active_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT DO NOTHING`,
        [
          userId,
          deviceInfo.deviceName || 'Unknown',
          deviceInfo.deviceType || 'mobile',
          deviceInfo.os || 'Unknown',
          deviceInfo.browser || 'App',
          deviceInfo.ipAddress || null,
        ]
      );
    } catch (err: any) {
      logger.warn(`[AuthService] Device registration failed: ${err.message}`);
    }
  }
}
