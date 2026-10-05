import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { SchemeStatus } from '../types/enums';

export class SchemeService {
  static async createScheme(orgId: string | null, userId: string, data: any) {
    const res = await query(
      `INSERT INTO schemes (
        org_id, created_by, title, provider_name, type, category,
        description, eligibility_criteria, benefits, documents_required,
        application_deadline, official_portal_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        orgId || null,
        userId,
        data.title,
        data.providerName,
        data.type,
        data.category,
        data.description,
        data.eligibilityCriteria || [],
        data.benefits || [],
        data.documentsRequired || [],
        data.applicationDeadline || null,
        data.officialPortalUrl || null,
        data.status || SchemeStatus.ACTIVE,
      ]
    );

    return res.rows[0];
  }

  static async listSchemes(params: {
    page?: any;
    limit?: any;
    type?: string;
    category?: string;
    search?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.type) {
      conditions.push(`type = $${idx++}`);
      values.push(params.type);
    }
    if (params.category) {
      conditions.push(`category = $${idx++}`);
      values.push(params.category);
    }
    if (params.search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx} OR provider_name ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM schemes ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const schemesRes = await query(
      `SELECT * FROM schemes ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return buildPaginatedResult(schemesRes.rows, total, page, limit);
  }

  static async getSchemeById(id: string) {
    const res = await query(`SELECT * FROM schemes WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }

  static async updateScheme(id: string, data: any) {
    const allowed = [
      'title', 'provider_name', 'type', 'category', 'description',
      'eligibility_criteria', 'benefits', 'documents_required',
      'application_deadline', 'official_portal_url', 'status'
    ];

    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (data[camel] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[camel]);
      }
    }

    if (fields.length === 0) return this.getSchemeById(id);

    fields.push('updated_at = NOW()');

    const res = await query(
      `UPDATE schemes SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return res.rows[0];
  }

  static async deleteScheme(id: string) {
    await query(`DELETE FROM schemes WHERE id = $1`, [id]);
    return { success: true };
  }

  static async applyForScheme(schemeId: string, userId: string, data: { documentUrls: string[]; applicantNotes?: string }) {
    const res = await query(
      `INSERT INTO scheme_applications (scheme_id, applicant_id, document_urls, applicant_notes, status)
       VALUES ($1, $2, $3, $4, 'submitted')
       RETURNING *`,
      [schemeId, userId, data.documentUrls || [], data.applicantNotes || null]
    );
    return res.rows[0];
  }

  static async listApplications(schemeId: string) {
    const res = await query(
      `SELECT a.*, u.full_name, u.email, u.phone
       FROM scheme_applications a
       JOIN users u ON a.applicant_id = u.id
       WHERE a.scheme_id = $1
       ORDER BY a.created_at DESC`,
      [schemeId]
    );
    return res.rows;
  }
}
