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
    // 1. Verify user exists and check current role
    const userRes = await query(
      `SELECT id, role, is_verified, full_name, email FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      throw new Error('User not found');
    }
    const user = userRes.rows[0];
    if (user.role?.toLowerCase() === 'organization' && user.is_verified) {
      throw new Error('User is already an approved organization');
    }

    // 2. Check if user already has an active PENDING request
    const pendingRes = await query(
      `SELECT id FROM organization_verification_requests 
       WHERE user_id = $1 AND status = 'PENDING' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const docUrls =
      data.documentUrls ||
      (data.documents ? data.documents.map((d: any) => d.url).filter(Boolean) : []);
    const docsJson = JSON.stringify(data.documents || []);

    let savedRequest;

    if (pendingRes.rows.length > 0) {
      // Update existing pending application
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
      logger.info(`[VerificationService] Updated pending org request ${savedRequest.id} for user ${userId}`);
    } else {
      // Insert new request
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
          userId,
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
      logger.info(`[VerificationService] Org verification submitted by user ${userId} for "${data.organizationName}"`);
    }

    // 3. Mark category selection completed on user record
    await query(
      `UPDATE users SET category_selection_completed = TRUE, updated_at = NOW() WHERE id = $1`,
      [userId]
    ).catch(() => {});

    // Sync to in-memory requests cache
    const existingIdx = inMemoryVerificationRequests.findIndex(r => r.id === savedRequest.id || r.user_id === userId);
    if (existingIdx !== -1) {
      inMemoryVerificationRequests[existingIdx] = { ...savedRequest, user_full_name: user?.full_name, user_email: user?.email };
    } else {
      inMemoryVerificationRequests.unshift({ ...savedRequest, user_full_name: user?.full_name, user_email: user?.email });
    }

    // 4. Notify admin accounts about the new/updated organization upgrade request
    query(`SELECT id FROM users WHERE role = 'admin'`).then((adminRes) => {
      for (const admin of adminRes.rows) {
        NotificationService.createNotification(
          admin.id,
          userId,
          'org_verification_submitted',
          'New Organization Upgrade Request',
          `${user?.full_name || 'A user'} submitted an upgrade request for "${data.organizationName}" (${data.category}).`,
          {
            requestId: savedRequest.id,
            applicantId: userId,
            organizationName: data.organizationName,
            category: data.category,
            type: 'org_verification_submitted',
          }
        ).catch(() => {});
      }
    }).catch(() => {});

    // 5. Send in-app notification & push notification to applicant user confirming submission
    NotificationService.createNotification(
      userId,
      userId,
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
    const res = await query(
      `SELECT * FROM organization_verification_requests 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) {
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
