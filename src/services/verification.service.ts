import { query } from '../config/database';
import { logger } from '../config/logger';

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
