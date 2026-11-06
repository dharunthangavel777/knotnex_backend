import { query } from '../config/database';
import { logger } from '../config/logger';
import { EmailService } from '../integrations/email';

export class VerificationService {
  /**
   * Submits an organization verification application for a user.
   * Marks category selection as completed for the user and leaves role as 'user'
   * until approved by an administrator.
   */
  static async applyForVerification(
    userId: string,
    data: {
      organizationName: string;
      category: string;
      organizationEmail: string;
      phone: string;
      website?: string;
    }
  ) {
    // 1. Mark category selection as completed on user
    await query(
      `UPDATE users SET category_selection_completed = TRUE, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    // 2. Insert verification request
    const res = await query(
      `INSERT INTO organization_verification_requests (
        user_id, organization_name, category, organization_email, phone, website, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *`,
      [
        userId,
        data.organizationName,
        data.category,
        data.organizationEmail,
        data.phone,
        data.website || null,
      ]
    );

    logger.info(`[VerificationService] Org verification submitted by user ${userId} for "${data.organizationName}"`);

    // Non-blocking confirmation email dispatch
    query('SELECT full_name FROM users WHERE id = $1', [userId]).then((userRes) => {
      const applicantName = userRes.rows[0]?.full_name || data.organizationName;
      if (data.organizationEmail) {
        EmailService.sendOrgVerificationSubmitted(
          data.organizationEmail,
          applicantName,
          data.organizationName,
          data.category
        ).catch((err: any) => {
          logger.warn('[VerificationService] Org verification email dispatch failed', { error: err.message });
        });
      }
    }).catch(() => {});

    return res.rows[0];
  }

  /**
   * Checks the latest verification request status for a user.
   */
  static async getMyVerificationStatus(userId: string) {
    const res = await query(
      `SELECT * FROM organization_verification_requests 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return { hasSubmitted: false, status: 'NONE', request: null };
    }

    const request = res.rows[0];
    return {
      hasSubmitted: true,
      status: request.status,
      request,
    };
  }

  /**
   * Marks category selection completed when user chooses to continue as a general user.
   */
  static async completeCategoryAsUser(userId: string) {
    await query(
      `UPDATE users SET category_selection_completed = TRUE, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    return { success: true };
  }
}
