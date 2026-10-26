import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { SchemeStatus } from '../types/enums';
import { config } from '../config';
import { logger } from '../config/logger';

// In-memory fallback for local dev when PostgreSQL is offline
export const inMemorySchemes: any[] = [];
export const inMemorySchemeApps: any[] = [];

export class SchemeService {
  static async createScheme(orgId: string | null, userId: string, data: any) {
    const title = data.title || data.name || 'Untitled Scheme';
    const providerName = data.providerName || data.provider || data.department || 'KnotNex Foundation';
    const type = data.type || 'NGO';
    const category = data.category || 'Welfare';
    const description = data.description || 'Scheme details and welfare benefits for community members.';
    const grantAmount = data.grantAmount || (data.fundingAmount ? `₹${data.fundingAmount}` : null);
    const fundingAmount = data.fundingAmount ? Number(data.fundingAmount) : null;
    const processSteps = JSON.stringify(data.processSteps || []);
    const faqs = JSON.stringify(data.faqs || []);
    const supportEmail = data.supportEmail || null;
    const supportPhone = data.supportPhone || null;
    const metadata = JSON.stringify(data.metadata || {});
    const initialStatus = data.status || SchemeStatus.PENDING_VERIFICATION;

    try {
      const res = await query(
        `INSERT INTO schemes (
          org_id, created_by, title, provider_name, type, category,
          description, eligibility_criteria, benefits, documents_required,
          application_deadline, official_portal_url, status,
          grant_amount, funding_amount, process_steps, faqs, support_email, support_phone, metadata, is_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *`,
        [
          orgId || null,
          userId,
          title,
          providerName,
          type,
          category,
          description,
          data.eligibilityCriteria || (data.eligibility ? [data.eligibility] : []),
          data.benefits || [],
          data.documentsRequired || data.documents || [],
          data.applicationDeadline || data.deadline || null,
          data.officialPortalUrl || data.portalUrl || null,
          initialStatus,
          grantAmount,
          fundingAmount,
          processSteps,
          faqs,
          supportEmail,
          supportPhone,
          metadata,
          initialStatus === SchemeStatus.ACTIVE,
        ]
      );

      const created = res.rows[0];
      inMemorySchemes.unshift(created);
      return created;
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        logger.warn('[SchemeService] DB query failed, storing scheme in-memory', dbErr.message);
        const newScheme = {
          id: `sch-${Date.now()}`,
          org_id: orgId,
          created_by: userId,
          title,
          provider_name: providerName,
          type,
          category,
          description,
          eligibility_criteria: data.eligibilityCriteria || (data.eligibility ? [data.eligibility] : []),
          benefits: data.benefits || [],
          documents_required: data.documentsRequired || data.documents || [],
          application_deadline: data.applicationDeadline || data.deadline || null,
          official_portal_url: data.officialPortalUrl || data.portalUrl || null,
          grant_amount: grantAmount,
          funding_amount: fundingAmount,
          status: initialStatus,
          is_verified: initialStatus === SchemeStatus.ACTIVE,
          applications_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemorySchemes.unshift(newScheme);
        return newScheme;
      }
      throw dbErr;
    }
  }

  static async listSchemes(params: {
    page?: any;
    limit?: any;
    type?: string;
    category?: string;
    status?: string;
    orgId?: string;
    org_id?: string;
    search?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const targetOrgId = params.orgId || params.org_id;
    if (targetOrgId) {
      conditions.push(`s.org_id = $${idx++}`);
      values.push(targetOrgId);
    }
    if (params.type) {
      conditions.push(`s.type = $${idx++}`);
      values.push(params.type);
    }
    if (params.category) {
      conditions.push(`s.category = $${idx++}`);
      values.push(params.category);
    }
    if (params.status) {
      conditions.push(`s.status = $${idx++}`);
      values.push(params.status);
    } else if (!targetOrgId) {
      conditions.push(`s.status = 'active'`);
    }
    if (params.search) {
      conditions.push(`(s.title ILIKE $${idx} OR s.description ILIKE $${idx} OR s.provider_name ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(`SELECT COUNT(*) FROM schemes s ${whereClause}`, values);
      const total = parseInt(countRes.rows[0].count, 10);

      const schemesRes = await query(
        `SELECT s.*,
                COALESCE((SELECT COUNT(*) FROM scheme_applications sa WHERE sa.scheme_id = s.id), 0) AS applications_count
         FROM schemes s
         ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      return buildPaginatedResult(schemesRes.rows, total, page, limit);
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        logger.warn('[SchemeService] DB unreachable, returning in-memory schemes');
        let filtered = [...inMemorySchemes];
        if (targetOrgId) filtered = filtered.filter(s => s.org_id === targetOrgId);
        if (params.status) {
          filtered = filtered.filter(s => s.status === params.status);
        } else if (!targetOrgId) {
          filtered = filtered.filter(s => s.status === 'active');
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }
      throw dbErr;
    }
  }

  static async getSchemeById(id: string) {
    try {
      const res = await query(
        `SELECT s.*,
                COALESCE((SELECT COUNT(*) FROM scheme_applications sa WHERE sa.scheme_id = s.id), 0) AS applications_count
         FROM schemes s
         WHERE s.id = $1`,
        [id]
      );
      return res.rows[0] || null;
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const found = inMemorySchemes.find(s => s.id === id);
        return found || null;
      }
      throw dbErr;
    }
  }

  static async updateScheme(id: string, data: any) {
    const allowed = [
      'title', 'provider_name', 'type', 'category', 'description',
      'eligibility_criteria', 'benefits', 'documents_required',
      'application_deadline', 'official_portal_url', 'status',
      'grant_amount', 'funding_amount', 'support_email', 'support_phone'
    ];

    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (data[camel] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[camel]);
      } else if (data[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return this.getSchemeById(id);

    fields.push('updated_at = NOW()');

    try {
      const res = await query(
        `UPDATE schemes SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const idx = inMemorySchemes.findIndex(s => s.id === id);
        if (idx !== -1) {
          inMemorySchemes[idx] = { ...inMemorySchemes[idx], ...data, updated_at: new Date().toISOString() };
          return inMemorySchemes[idx];
        }
      }
      throw dbErr;
    }
  }

  static async deleteScheme(id: string) {
    try {
      await query(`DELETE FROM schemes WHERE id = $1`, [id]);
      return { success: true };
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const idx = inMemorySchemes.findIndex(s => s.id === id);
        if (idx !== -1) inMemorySchemes.splice(idx, 1);
        return { success: true };
      }
      throw dbErr;
    }
  }

  static async applyForScheme(schemeId: string, userId: string, data: any) {
    const requestedAmount = data.requestedAmount || data.funding || '₹10,00,000';
    const contactPerson = data.contactPerson || null;
    const orgType = data.orgType || 'NGO';
    const stage = data.stage || 'Under Review';
    const status = data.status || 'submitted';

    try {
      const res = await query(
        `INSERT INTO scheme_applications (
          scheme_id, applicant_id, document_urls, applicant_notes,
          status, stage, requested_amount, contact_person, org_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          schemeId,
          userId,
          data.documentUrls || [],
          data.applicantNotes || null,
          status,
          stage,
          requestedAmount,
          contactPerson,
          orgType
        ]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const app = {
          id: `sapp-${Date.now()}`,
          scheme_id: schemeId,
          applicant_id: userId,
          document_urls: data.documentUrls || [],
          applicant_notes: data.applicantNotes || '',
          status,
          stage,
          requested_amount: requestedAmount,
          contact_person: contactPerson,
          org_type: orgType,
          created_at: new Date().toISOString(),
        };
        inMemorySchemeApps.unshift(app);
        return app;
      }
      throw dbErr;
    }
  }

  static async listApplications(schemeId: string) {
    try {
      const res = await query(
        `SELECT a.*,
                u.full_name AS applicant,
                u.full_name,
                u.email,
                u.phone,
                u.avatar_url,
                s.title AS scheme_title
         FROM scheme_applications a
         JOIN users u ON a.applicant_id = u.id
         JOIN schemes s ON a.scheme_id = s.id
         WHERE a.scheme_id = $1
         ORDER BY a.created_at DESC`,
        [schemeId]
      );
      return res.rows;
    } catch (dbErr: any) {
      if (config.env === 'development') {
        return inMemorySchemeApps.filter(a => a.scheme_id === schemeId);
      }
      throw dbErr;
    }
  }

  static async getApplicationById(applicationId: string) {
    try {
      const res = await query(
        `SELECT a.*,
                u.full_name AS applicant,
                u.full_name,
                u.email,
                u.phone,
                u.avatar_url,
                s.title AS scheme_title,
                s.provider_name
         FROM scheme_applications a
         JOIN users u ON a.applicant_id = u.id
         JOIN schemes s ON a.scheme_id = s.id
         WHERE a.id = $1`,
        [applicationId]
      );
      return res.rows[0] || null;
    } catch (dbErr: any) {
      if (config.env === 'development') {
        return inMemorySchemeApps.find(a => a.id === applicationId) || null;
      }
      throw dbErr;
    }
  }

  static async updateApplicationStatus(applicationId: string, status: string, stage?: string, reviewerNotes?: string) {
    const updatedStage = stage || (status.toLowerCase() === 'approved' ? 'Approved & Disbursed' : 'Under Review');

    try {
      const res = await query(
        `UPDATE scheme_applications
         SET status = $1, stage = $2, reviewer_notes = COALESCE($3, reviewer_notes), updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status.toLowerCase(), updatedStage, reviewerNotes || null, applicationId]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const found = inMemorySchemeApps.find(a => a.id === applicationId);
        if (found) {
          found.status = status.toLowerCase();
          found.stage = updatedStage;
          if (reviewerNotes) found.reviewer_notes = reviewerNotes;
          return found;
        }
      }
      throw dbErr;
    }
  }

  static async getOrgSchemeApplications(orgId: string) {
    try {
      const res = await query(
        `SELECT a.*,
                u.full_name AS applicant,
                u.full_name,
                u.email,
                u.phone,
                u.avatar_url,
                s.title AS scheme_title,
                s.category AS scheme_category
         FROM scheme_applications a
         JOIN schemes s ON a.scheme_id = s.id
         JOIN users u ON a.applicant_id = u.id
         WHERE s.org_id = $1
         ORDER BY a.created_at DESC`,
        [orgId]
      );
      return res.rows;
    } catch (dbErr: any) {
      if (config.env === 'development') {
        return inMemorySchemeApps;
      }
      throw dbErr;
    }
  }
}
