import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';

export class AdminService {
  static async setBanStatus(userId: string, isBanned: boolean) {
    const res = await query(
      `UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, is_banned`,
      [isBanned, userId]
    );
    return res.rows[0];
  }

  static async setVerificationStatus(userId: string, isVerified: boolean) {
    const res = await query(
      `UPDATE users SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, is_verified`,
      [isVerified, userId]
    );
    return res.rows[0];
  }

  static async getFeedsCurationQueue(params: { page?: any; limit?: any }) {
    const { page, limit, offset } = getPagination(params);

    const countRes = await query(`SELECT COUNT(*) FROM posts WHERE flagged_for_review = true`);
    const total = parseInt(countRes.rows[0].count, 10);

    const postsRes = await query(
      `SELECT p.*, u.full_name as author_name, u.email as author_email
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.flagged_for_review = true
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return buildPaginatedResult(postsRes.rows, total, page, limit);
  }

  static async moderateFeedPost(postId: string, action: 'approve' | 'remove') {
    if (action === 'remove') {
      await query(`DELETE FROM posts WHERE id = $1`, [postId]);
      return { action: 'removed' };
    } else {
      await query(`UPDATE posts SET flagged_for_review = false, is_moderated = true WHERE id = $1`, [postId]);
      return { action: 'approved' };
    }
  }

  static async verifyOrganization(orgId: string, isVerified: boolean) {
    const res = await query(
      `UPDATE organizations SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_verified`,
      [isVerified, orgId]
    );
    return res.rows[0];
  }
}
