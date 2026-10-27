import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { config } from '../config';
import { inMemoryUsers } from './user.service';
import { inMemoryEvents } from './event.service';
import { inMemoryJobs } from './job.service';
import { inMemorySchemes } from './scheme.service';
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

  /**
   * Content Verification System for Events, Jobs, and Schemes
   */
  static async listPendingContent() {
    try {
      const [eventsRes, jobsRes, schemesRes] = await Promise.all([
        query(`SELECT e.*, o.name as org_name, o.logo_url as org_logo FROM events e LEFT JOIN organizations o ON e.org_id = o.id WHERE e.status = 'pending_verification' ORDER BY e.created_at DESC`),
        query(`SELECT j.*, o.name as org_name, o.logo_url as org_logo FROM jobs j LEFT JOIN organizations o ON j.org_id = o.id WHERE j.status = 'pending_verification' ORDER BY j.created_at DESC`),
        query(`SELECT s.*, o.name as org_name, o.logo_url as org_logo FROM schemes s LEFT JOIN organizations o ON s.org_id = o.id WHERE s.status = 'pending_verification' ORDER BY s.created_at DESC`),
      ]);
      return {
        events: eventsRes.rows,
        jobs: jobsRes.rows,
        schemes: schemesRes.rows,
        totalPending: eventsRes.rows.length + jobsRes.rows.length + schemesRes.rows.length,
      };
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const evs = inMemoryEvents.filter((e: any) => e.status === 'pending_verification');
        const jbs = inMemoryJobs.filter((j: any) => j.status === 'pending_verification');
        const schs = inMemorySchemes.filter((s: any) => s.status === 'pending_verification');
        return {
          events: evs,
          jobs: jbs,
          schemes: schs,
          totalPending: evs.length + jbs.length + schs.length,
        };
      }
      throw err;
    }
  }

  static async verifyEvent(eventId: string, adminUserId?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE events 
         SET status = 'published', is_verified = true, verified_at = NOW(), verified_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reviewerId, eventId]
      );
      if (res.rows.length > 0) {
        const ev = res.rows[0];
        if (ev.created_by) {
          await NotificationService.createNotification(
            ev.created_by,
            reviewerId,
            'event_verified',
            'Event Approved & Published!',
            `Your event "${ev.title}" has been verified and is now live across KnotNex.`,
            { eventId: ev.id, status: 'published' }
          ).catch(() => {});
        }
        return ev;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const ev = inMemoryEvents.find((e: any) => String(e.id) === String(eventId));
        if (ev) {
          ev.status = 'published';
          ev.is_verified = true;
          ev.verified_at = new Date().toISOString();
          return ev;
        }
      }
      throw dbErr;
    }
    throw new Error('Event not found');
  }

  static async rejectEvent(eventId: string, adminUserId?: string, reason?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE events 
         SET status = 'rejected', is_verified = false, rejection_reason = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reason || 'Content does not meet publication standards', eventId]
      );
      if (res.rows.length > 0) {
        const ev = res.rows[0];
        if (ev.created_by) {
          await NotificationService.createNotification(
            ev.created_by,
            reviewerId,
            'event_rejected',
            'Event Review Notice',
            `Your event "${ev.title}" requires revisions: ${reason || 'Does not meet guidelines'}`,
            { eventId: ev.id, status: 'rejected', reason }
          ).catch(() => {});
        }
        return ev;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const ev = inMemoryEvents.find((e: any) => String(e.id) === String(eventId));
        if (ev) {
          ev.status = 'rejected';
          ev.is_verified = false;
          ev.rejection_reason = reason;
          return ev;
        }
      }
      throw dbErr;
    }
    throw new Error('Event not found');
  }

  static async verifyJob(jobId: string, adminUserId?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE jobs 
         SET status = 'open', is_verified = true, verified_at = NOW(), verified_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reviewerId, jobId]
      );
      if (res.rows.length > 0) {
        const job = res.rows[0];
        if (job.created_by) {
          await NotificationService.createNotification(
            job.created_by,
            reviewerId,
            'job_verified',
            'Job Opportunity Live!',
            `Your job opening "${job.title}" has been verified and published to applicants.`,
            { jobId: job.id, status: 'open' }
          ).catch(() => {});
        }
        return job;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const job = inMemoryJobs.find((j: any) => String(j.id) === String(jobId));
        if (job) {
          job.status = 'open';
          job.is_verified = true;
          job.verified_at = new Date().toISOString();
          return job;
        }
      }
      throw dbErr;
    }
    throw new Error('Job not found');
  }

  static async rejectJob(jobId: string, adminUserId?: string, reason?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE jobs 
         SET status = 'rejected', is_verified = false, rejection_reason = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reason || 'Job requirements require revisions', jobId]
      );
      if (res.rows.length > 0) {
        const job = res.rows[0];
        if (job.created_by) {
          await NotificationService.createNotification(
            job.created_by,
            reviewerId,
            'job_rejected',
            'Job Review Notice',
            `Your job posting "${job.title}" was not approved: ${reason || 'Requires revisions'}`,
            { jobId: job.id, status: 'rejected', reason }
          ).catch(() => {});
        }
        return job;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const job = inMemoryJobs.find((j: any) => String(j.id) === String(jobId));
        if (job) {
          job.status = 'rejected';
          job.is_verified = false;
          job.rejection_reason = reason;
          return job;
        }
      }
      throw dbErr;
    }
    throw new Error('Job not found');
  }

  static async verifyScheme(schemeId: string, adminUserId?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE schemes 
         SET status = 'active', is_verified = true, verified_at = NOW(), verified_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reviewerId, schemeId]
      );
      if (res.rows.length > 0) {
        const scheme = res.rows[0];
        if (scheme.created_by) {
          await NotificationService.createNotification(
            scheme.created_by,
            reviewerId,
            'scheme_verified',
            'Grant Scheme Live!',
            `Your welfare scheme "${scheme.title}" has been verified and is active for applications.`,
            { schemeId: scheme.id, status: 'active' }
          ).catch(() => {});
        }
        return scheme;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const s = inMemorySchemes.find((sch: any) => String(sch.id) === String(schemeId));
        if (s) {
          s.status = 'active';
          s.is_verified = true;
          s.verified_at = new Date().toISOString();
          return s;
        }
      }
      throw dbErr;
    }
    throw new Error('Scheme not found');
  }

  static async rejectScheme(schemeId: string, adminUserId?: string, reason?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE schemes 
         SET status = 'rejected', is_verified = false, rejection_reason = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reason || 'Welfare criteria require review', schemeId]
      );
      if (res.rows.length > 0) {
        const scheme = res.rows[0];
        if (scheme.created_by) {
          await NotificationService.createNotification(
            scheme.created_by,
            reviewerId,
            'scheme_rejected',
            'Scheme Review Notice',
            `Your scheme "${scheme.title}" was not approved: ${reason || 'Requires revisions'}`,
            { schemeId: scheme.id, status: 'rejected', reason }
          ).catch(() => {});
        }
        return scheme;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const s = inMemorySchemes.find((sch: any) => String(sch.id) === String(schemeId));
        if (s) {
          s.status = 'rejected';
          s.is_verified = false;
          s.rejection_reason = reason;
          return s;
        }
      }
      throw dbErr;
    }
    throw new Error('Scheme not found');
  }
}

