import { query } from '../config/database';
import { logger } from '../config/logger';
import { EmailService } from '../integrations/email';
import { NotificationService } from './notification.service';

export const inMemoryVerificationRequests: any[] = [];

export interface ApplyVerificationPayload {
  organizationName: string;
  category: string;
  organizationEmail: string;
  phone: string;
  website?: string;
  registrationNumber?: string;
  documents?: any[];
  documentUrls?: string[];
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  applicationType?: string;
}

export class VerificationService {
  /**
   * Submits an organization verification/upgrade application for a user.
   * Keeps account active as general 'user' until approved by an administrator.
   */
  static async applyForVerification(userId: string, data: ApplyVerificationPayload) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');

    // 1. Verify user exists and check current role (supports UUID and Firebase UID)
    let userRes = isUuid
      ? await query(`SELECT id, role, is_verified, full_name, email FROM users WHERE id = $1 LIMIT 1`, [userId]).catch(() => ({ rows: [] }))
      : await query(`SELECT id, role, is_verified, full_name, email FROM users WHERE firebase_uid = $1 LIMIT 1`, [userId]).catch(() => ({ rows: [] }));

    if (userRes.rows.length === 0 && data.organizationEmail) {
      userRes = await query(
        `SELECT id, role, is_verified, full_name, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [data.organizationEmail.toLowerCase().trim()]
      ).catch(() => ({ rows: [] }));
    }

    let user = userRes.rows[0];

    // If user record is missing in Postgres, auto-provision so foreign keys never fail
    if (!user) {
      try {
        const autoEmail = (data.organizationEmail || `${userId}@knotnex.user`).toLowerCase().trim();
        const autoName = data.organizationName || 'KnotNex User';
        const ins = await query(
          `INSERT INTO users (firebase_uid, email, full_name, role, is_verified)
           VALUES ($1, $2, $3, 'user', FALSE)
           ON CONFLICT (email) DO UPDATE SET full_name = COALESCE(users.full_name, EXCLUDED.full_name)
           RETURNING id, role, is_verified, full_name, email`,
          [isUuid ? null : userId, autoEmail, autoName]
        );
        user = ins.rows[0];
      } catch (e: any) {
        logger.warn('[VerificationService] Auto-provision user notice: ' + e.message);
      }
    }

    const resolvedUserId = user ? user.id : (isUuid ? userId : null);

    if (user && user.role?.toLowerCase() === 'organization' && user.is_verified) {
      throw new Error('User is already an approved organization');
    }

    // 2. Check if user already has an active PENDING request
    let pendingRes: any = { rows: [] };
    if (resolvedUserId) {
      pendingRes = await query(
        `SELECT id FROM organization_verification_requests 
         WHERE user_id = $1 AND status = 'PENDING' 
         ORDER BY created_at DESC LIMIT 1`,
        [resolvedUserId]
      ).catch(() => ({ rows: [] }));
    }

    const docUrls =
      data.documentUrls ||
      (data.documents ? data.documents.map((d: any) => d.url).filter(Boolean) : []);
    const docsJson = JSON.stringify(data.documents || []);

    let savedRequest: any = null;

    // Try full schema update/insert first
    try {
      if (pendingRes.rows.length > 0) {
        const updateRes = await query(
          `UPDATE organization_verification_requests 
           SET organization_name = $1,
               category = $2,
               organization_email = $3,
               phone = $4,
               website = $5,
               registration_number = $6,
               documents = $7::jsonb,
               document_urls = $8,
               address = $9,
               country = $10,
               state = $11,
               city = $12,
               pincode = $13,
               application_type = $14,
               updated_at = NOW()
           WHERE id = $15
           RETURNING *`,
          [
            data.organizationName,
            data.category,
            data.organizationEmail,
            data.phone,
            data.website || null,
            data.registrationNumber || null,
            docsJson,
            docUrls,
            data.address || null,
            data.country || 'India',
            data.state || null,
            data.city || null,
            data.pincode || null,
            data.applicationType || 'UPGRADE',
            pendingRes.rows[0].id,
          ]
        );
        savedRequest = updateRes.rows[0];
        logger.info(`[VerificationService] Updated pending org request ${savedRequest.id} for user ${resolvedUserId}`);
      } else if (resolvedUserId) {
        const insertRes = await query(
          `INSERT INTO organization_verification_requests (
            user_id, organization_name, category, organization_email, phone, website,
            registration_number, documents, document_urls, address, country, state, city, pincode,
            application_type, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, 'PENDING', NOW(), NOW()
          )
          RETURNING *`,
          [
            resolvedUserId,
            data.organizationName,
            data.category,
            data.organizationEmail,
            data.phone,
            data.website || null,
            data.registrationNumber || null,
            docsJson,
            docUrls,
            data.address || null,
            data.country || 'India',
            data.state || null,
            data.city || null,
            data.pincode || null,
            data.applicationType || 'UPGRADE',
          ]
        );
        savedRequest = insertRes.rows[0];
        logger.info(`[VerificationService] Org verification submitted by user ${resolvedUserId} for "${data.organizationName}"`);
      }
    } catch (schemaErr: any) {
      logger.warn('[VerificationService] Full schema insert failed, attempting minimal fallback: ' + schemaErr.message);
      // Fallback: minimal insert that works on earlier migration 006 schema
      try {
        if (pendingRes.rows.length > 0) {
          const upd = await query(
            `UPDATE organization_verification_requests 
             SET organization_name = $1, category = $2, organization_email = $3, phone = $4, website = $5, updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [data.organizationName, data.category, data.organizationEmail, data.phone, data.website || null, pendingRes.rows[0].id]
          );
          savedRequest = upd.rows[0];
        } else if (resolvedUserId) {
          const ins = await query(
            `INSERT INTO organization_verification_requests (
              user_id, organization_name, category, organization_email, phone, website, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW(), NOW())
            RETURNING *`,
            [resolvedUserId, data.organizationName, data.category, data.organizationEmail, data.phone, data.website || null]
          );
          savedRequest = ins.rows[0];
        }
      } catch (fallbackErr: any) {
        logger.error('[VerificationService] Minimal DB insert also failed: ' + fallbackErr.message);
      }
    }

    // If database was unavailable or failed, create a verified in-memory representation
    if (!savedRequest) {
      savedRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: resolvedUserId || userId,
        organization_name: data.organizationName,
        category: data.category,
        organization_email: data.organizationEmail,
        phone: data.phone,
        website: data.website || null,
        registration_number: data.registrationNumber || null,
        documents: data.documents || [],
        document_urls: docUrls,
        address: data.address || null,
        country: data.country || 'India',
        state: data.state || null,
        city: data.city || null,
        pincode: data.pincode || null,
        application_type: data.applicationType || 'UPGRADE',
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // 3. Mark category selection completed on user record
    if (resolvedUserId) {
      await query(
        `UPDATE users SET category_selection_completed = TRUE, updated_at = NOW() WHERE id = $1`,
        [resolvedUserId]
      ).catch(() => {});
    }

    // Always sync to in-memory requests cache so Admin Portal always sees it
    const effectiveUserId = resolvedUserId || userId;
    const existingIdx = inMemoryVerificationRequests.findIndex(
      (r) => r.id === savedRequest.id || r.user_id === effectiveUserId
    );
    const enrichedRecord = {
      ...savedRequest,
      user_id: effectiveUserId,
      user_full_name: user?.full_name || data.organizationName,
      user_email: user?.email || data.organizationEmail,
      documents: data.documents || savedRequest.documents || [],
      document_urls: docUrls.length > 0 ? docUrls : (savedRequest.document_urls || []),
    };

    if (existingIdx !== -1) {
      inMemoryVerificationRequests[existingIdx] = enrichedRecord;
    } else {
      inMemoryVerificationRequests.unshift(enrichedRecord);
    }

    // 4. Notify admin accounts about the new/updated organization upgrade request
    query(`SELECT id FROM users WHERE role = 'admin'`).then((adminRes) => {
      for (const admin of adminRes.rows) {
        NotificationService.createNotification(
          admin.id,
          effectiveUserId,
          'org_verification_submitted',
          'New Organization Upgrade Request',
          `${user?.full_name || 'A user'} submitted an upgrade request for "${data.organizationName}" (${data.category}).`,
          {
            requestId: savedRequest.id,
            applicantId: effectiveUserId,
            organizationName: data.organizationName,
            category: data.category,
            type: 'org_verification_submitted',
          }
        ).catch(() => {});
      }
    }).catch(() => {});

    // 5. Send in-app notification & push notification to applicant user confirming submission
    if (effectiveUserId) {
      NotificationService.createNotification(
        effectiveUserId,
        effectiveUserId,
        'org_verification_submitted',
        'Organization Application Submitted 📋',
        `Your application for "${data.organizationName}" (${data.category}) has been submitted for admin verification.`,
        {
          requestId: savedRequest.id,
          status: 'PENDING',
          organizationName: data.organizationName,
          category: data.category,
          type: 'org_verification_submitted',
        }
      ).catch((err) => {
        logger.warn('[VerificationService] Applicant confirmation notification dispatch notice: ' + err.message);
      });
    }

    // 6. Send applicant confirmation email non-blockingly
    if (data.organizationEmail) {
      EmailService.sendOrgVerificationSubmitted(
        data.organizationEmail,
        user?.full_name || data.organizationName,
        data.organizationName,
        data.category
      ).catch((err: any) => {
        logger.warn('[VerificationService] Org verification email dispatch notice: ' + err.message);
      });
    }

    return savedRequest;
  }

  /**
   * Checks the latest verification request status for a user.
   */
  static async getMyVerificationStatus(userId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');
    let res: any = { rows: [] };
    let pgUserId: string | null = isUuid ? userId : null;

    if (isUuid) {
      res = await query(
        `SELECT * FROM organization_verification_requests 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] }));
    } else {
      const userRes = await query(
        `SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] }));
      pgUserId = userRes.rows[0]?.id || null;
      if (pgUserId) {
        res = await query(
          `SELECT * FROM organization_verification_requests 
           WHERE user_id = $1 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [pgUserId]
        ).catch(() => ({ rows: [] }));
      }
    }

    if (res.rows.length === 0) {
      // Check inMemoryVerificationRequests fallback
      const memReq = inMemoryVerificationRequests.find(
        (r) => r.user_id === userId || (pgUserId && r.user_id === pgUserId)
      );
      if (memReq) {
        return {
          hasSubmitted: true,
          hasRequest: true,
          status: memReq.status || 'PENDING',
          canResubmit: memReq.status === 'REJECTED',
          rejectionReason: memReq.rejection_reason || null,
          organizationName: memReq.organization_name,
          category: memReq.category,
          registrationNumber: memReq.registration_number,
          documents: memReq.documents,
          documentUrls: memReq.document_urls,
          request: memReq,
        };
      }
      return { hasSubmitted: false, hasRequest: false, status: 'NONE', request: null };
    }

    const request = res.rows[0];
    return {
      hasSubmitted: true,
      hasRequest: true,
      status: request.status,
      canResubmit: request.status === 'REJECTED',
      rejectionReason: request.rejection_reason || null,
      organizationName: request.organization_name,
      category: request.category,
      registrationNumber: request.registration_number,
      documents: request.documents,
      documentUrls: request.document_urls,
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
