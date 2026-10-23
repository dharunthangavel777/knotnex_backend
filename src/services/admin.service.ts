import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { config } from '../config';
import { inMemoryUsers } from './user.service';
import { NotificationService } from './notification.service';
import { FirebaseAuthIntegration } from '../integrations/firebase/auth.firebase';
import { generateSlug } from '../utils/slug.util';
import { logger } from '../config/logger';

async function resolveReviewerId(adminUserId?: string): Promise<string | null> {
  if (!adminUserId || adminUserId === 'admin') return null;
  try {
    const userCheck = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [adminUserId]);
    return userCheck.rows.length > 0 ? adminUserId : null;
  } catch {
    return null;
  }
}

function mapCategoryToOrgType(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('ngo') || cat.includes('non-profit')) return 'NGO';
  if (cat.includes('csr') || cat.includes('corporate')) return 'CSR Company';
  if (cat.includes('foundation')) return 'Foundation';
  if (cat.includes('hospital') || cat.includes('health')) return 'Hospital';
  if (cat.includes('school') || cat.includes('education') || cat.includes('edtech')) return 'School';
  if (cat.includes('rehab')) return 'Rehabilitation Center';
  return 'Other';
}

export class AdminService {
  static async setBanStatus(userId: string, isBanned: boolean) {
    try {
      const res = await query(
        `UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, is_banned`,
        [isBanned, userId]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const u = inMemoryUsers.find((user: any) => user.id === userId);
        if (u) {
          u.is_banned = isBanned;
          u.status = isBanned ? 'Banned' : 'Active';
          return { id: u.id, full_name: u.full_name, email: u.email, is_banned: u.is_banned };
        }
      }
      throw dbErr;
    }
  }

  static async setVerificationStatus(userId: string, isVerified: boolean) {
    try {
      const res = await query(
        `UPDATE users SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, is_verified`,
        [isVerified, userId]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const u = inMemoryUsers.find((user: any) => user.id === userId);
        if (u) {
          u.is_verified = isVerified;
          return { id: u.id, full_name: u.full_name, email: u.email, is_verified: u.is_verified };
        }
      }
      throw dbErr;
    }
  }

  static async getFeedsCurationQueue(params: { page?: any; limit?: any }) {
    const { page, limit, offset } = getPagination(params);

    try {
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
    } catch (dbErr: any) {
      if (config.env === 'development') {
        return buildPaginatedResult([], 0, page, limit);
      }
      throw dbErr;
    }
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

  /**
   * Lists all organization verification requests with optional status filtering.
   */
  static async listVerificationRequests(params: { page?: any; limit?: any; status?: string }) {
    const { page, limit, offset } = getPagination(params);
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`r.status = $${idx++}`);
      values.push(params.status.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(
        `SELECT COUNT(*) FROM organization_verification_requests r ${whereClause}`,
        values
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const rowsRes = await query(
        `SELECT r.*, u.full_name as user_full_name, u.email as user_email, u.avatar_url as user_avatar, u.role as user_role
         FROM organization_verification_requests r
         JOIN users u ON u.id = r.user_id
         ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      return buildPaginatedResult(rowsRes.rows, total, page, limit);
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const devRequests = inMemoryUsers
          .filter((u: any) => u.verification_status === 'PENDING' || u.verification_request_id)
          .map((u: any) => ({
            id: u.verification_request_id || `vr-${u.id}`,
            user_id: u.id,
            organization_name: u.organization_name || u.full_name,
            category: u.organization_category || 'NGO',
            organization_email: u.organization_email || u.email,
            phone: u.organization_phone || u.phone,
            website: u.organization_website || 'https://knotnex.com',
            status: u.verification_status || 'PENDING',
            created_at: u.created_at,
            user_full_name: u.full_name,
            user_email: u.email,
            user_avatar: u.avatar_url,
            user_role: u.role,
          }));
        let filtered = devRequests;
        if (params.status) {
          filtered = devRequests.filter((r: any) => r.status.toLowerCase() === params.status?.toLowerCase());
        }
        return buildPaginatedResult(filtered.slice(offset, offset + limit), filtered.length, page, limit);
      }
      throw dbErr;
    }
  }

  /**
   * Approves an organization verification request:
   * 1. Marks request status as APPROVED.
   * 2. Automatically updates the applicant user role to 'organization' and is_verified to true.
   * 3. Creates the organization entry linked to this user as owner.
   * 4. Updates Firebase custom claims.
   * 5. Sends an in-app and push notification to the user.
   */
  static async approveVerificationRequest(requestId: string, adminUserId?: string) {
    // 1. Fetch request
    const reqRes = await query(
      `SELECT * FROM organization_verification_requests WHERE id = $1`,
      [requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('Verification request not found');
    }
    const request = reqRes.rows[0];
    const userId = request.user_id;

    const reviewerId = await resolveReviewerId(adminUserId);

    // 2. Update request status to APPROVED
    await query(
      `UPDATE organization_verification_requests 
       SET status = 'APPROVED', reviewed_by = $1, updated_at = NOW() 
       WHERE id = $2`,
      [reviewerId, requestId]
    );

    // 3. Elevate user role to 'organization' and mark verified
    const userRes = await query(
      `UPDATE users 
       SET role = 'organization', is_verified = TRUE, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, firebase_uid, email, full_name, role, is_verified`,
      [userId]
    );
    const updatedUser = userRes.rows[0];

    // 4. Create or update the organization entry for this user
    const slug = generateSlug(request.organization_name);
    const orgType = mapCategoryToOrgType(request.category);

    const orgRes = await query(
      `INSERT INTO organizations (
        owner_id, name, slug, type, about, contact_email, contact_phone, website, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      ON CONFLICT (slug) DO UPDATE
        SET is_verified = TRUE, updated_at = NOW()
      RETURNING *`,
      [
        userId,
        request.organization_name,
        slug,
        orgType,
        `Verified ${request.category} on Knotnex`,
        request.organization_email,
        request.phone,
        request.website || null,
      ]
    );
    const org = orgRes.rows[0];

    // 5. Add owner to org_team_members
    await query(
      `INSERT INTO org_team_members (org_id, user_id, role_in_org, permissions)
       VALUES ($1, $2, 'Owner', ARRAY['admin', 'all'])
       ON CONFLICT DO NOTHING`,
      [org.id, userId]
    ).catch(() => {});

    // 6. Update Firebase custom claims if Firebase UID is available
    if (updatedUser?.firebase_uid) {
      await FirebaseAuthIntegration.setCustomUserClaims(updatedUser.firebase_uid, {
        role: 'organization',
        isVerified: true,
      }).catch((err) => {
        logger.warn('[AdminService] Could not update Firebase claims', { error: err.message });
      });
    }

    // 7. Dispatch in-app notification & push notification
    const notifTitle = 'Organization Account Approved! 🎉';
    const notifBody = `Congratulations! Your organization application for "${request.organization_name}" has been approved. Your account is now switched to Organization mode.`;
    
    await NotificationService.createNotification(
      userId,
      reviewerId,
      'org_approved',
      notifTitle,
      notifBody,
      {
        orgId: org.id,
        role: 'organization',
        orgName: request.organization_name,
        category: request.category,
      }
    );

    logger.info(`[AdminService] Approved org verification request ${requestId} for user ${userId}. Role elevated to organization.`);

    return {
      success: true,
      request: { ...request, status: 'APPROVED' },
      user: updatedUser,
      organization: org,
    };
  }

  /**
   * Rejects an organization verification request and notifies the applicant.
   */
  static async rejectVerificationRequest(requestId: string, adminUserId?: string, reason?: string) {
    const reqRes = await query(
      `SELECT * FROM organization_verification_requests WHERE id = $1`,
      [requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('Verification request not found');
    }
    const request = reqRes.rows[0];

    const reviewerId = await resolveReviewerId(adminUserId);

    await query(
      `UPDATE organization_verification_requests 
       SET status = 'REJECTED', reviewed_by = $1, rejection_reason = $2, updated_at = NOW() 
       WHERE id = $3`,
      [reviewerId, reason || null, requestId]
    );

    const notifTitle = 'Organization Application Update';
    const notifBody = reason
      ? `Your organization application for "${request.organization_name}" was not approved: ${reason}`
      : `Your organization application for "${request.organization_name}" was not approved at this time.`;

    await NotificationService.createNotification(
      request.user_id,
      reviewerId,
      'org_rejected',
      notifTitle,
      notifBody,
      {
        requestId,
        status: 'REJECTED',
        reason: reason || '',
      }
    );

    return {
      success: true,
      requestId,
      status: 'REJECTED',
      reason,
    };
  }
}

