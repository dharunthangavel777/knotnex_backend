import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { JobStatus } from '../types/enums';

export class JobService {
  static async createJob(orgId: string, userId: string, data: any) {
    const res = await query(
      `INSERT INTO jobs (
        org_id, created_by, title, department, type, location_type, location,
        description, requirements, responsibilities, disability_accommodations,
        min_salary, max_salary, currency, experience_level, education_level,
        deadline, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        orgId,
        userId,
        data.title,
        data.department || null,
        data.type,
        data.locationType,
        data.location || null,
        data.description,
        data.requirements || [],
        data.responsibilities || [],
        data.disabilityAccommodations || [],
        data.minSalary || null,
        data.maxSalary || null,
        data.currency || 'INR',
        data.experienceLevel || null,
        data.educationLevel || null,
        data.deadline || null,
        data.status || JobStatus.OPEN,
      ]
    );

    return res.rows[0];
  }

  static async listJobs(params: {
    page?: any;
    limit?: any;
    type?: string;
    locationType?: string;
    status?: string;
    search?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.type) {
      conditions.push(`j.type = $${idx++}`);
      values.push(params.type);
    }
    if (params.locationType) {
      conditions.push(`j.location_type = $${idx++}`);
      values.push(params.locationType);
    }
    if (params.status) {
      conditions.push(`j.status = $${idx++}`);
      values.push(params.status);
    } else {
      conditions.push(`j.status = 'open'`);
    }
    if (params.search) {
      conditions.push(`(j.title ILIKE $${idx} OR j.description ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM jobs j ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const jobsRes = await query(
      `SELECT j.*, o.name as org_name, o.logo_url as org_logo
       FROM jobs j
       JOIN organizations o ON j.org_id = o.id
       ${whereClause}
       ORDER BY j.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return buildPaginatedResult(jobsRes.rows, total, page, limit);
  }

  static async getJobById(id: string) {
    const res = await query(
      `SELECT j.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about, o.website as org_website
       FROM jobs j
       JOIN organizations o ON j.org_id = o.id
       WHERE j.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async updateJob(id: string, data: any) {
    const allowed = [
      'title', 'department', 'type', 'location_type', 'location', 'description',
      'requirements', 'responsibilities', 'disability_accommodations', 'min_salary',
      'max_salary', 'currency', 'experience_level', 'education_level', 'deadline', 'status'
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

    if (fields.length === 0) return this.getJobById(id);

    fields.push('updated_at = NOW()');

    const res = await query(
      `UPDATE jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return res.rows[0];
  }

  static async deleteJob(id: string) {
    await query(`DELETE FROM jobs WHERE id = $1`, [id]);
    return { success: true };
  }

  static async saveJob(userId: string, jobId: string) {
    await query(
      `INSERT INTO saved_items (user_id, item_id, item_type)
       VALUES ($1, $2, 'job')
       ON CONFLICT (user_id, item_id, item_type) DO NOTHING`,
      [userId, jobId]
    );
    return { saved: true };
  }

  static async getSimilarJobs(jobId: string) {
    const current = await this.getJobById(jobId);
    if (!current) return [];

    const res = await query(
      `SELECT j.*, o.name as org_name, o.logo_url as org_logo
       FROM jobs j
       JOIN organizations o ON j.org_id = o.id
       WHERE j.id != $1 AND (j.type = $2 OR j.location_type = $3) AND j.status = 'open'
       ORDER BY j.created_at DESC
       LIMIT 4`,
      [jobId, current.type, current.location_type]
    );

    return res.rows;
  }
}
