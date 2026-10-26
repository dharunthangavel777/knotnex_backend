import { query } from '../config/database';
import { config } from '../config';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { JobStatus } from '../types/enums';

export const inMemoryJobs: any[] = [];

export class JobService {
  static async createJob(orgId: string, userId: string, data: any) {
    const title = data.title || data.role || 'Untitled Opportunity';
    const department = data.department || data.dept || 'General';
    const type = data.type ? data.type.toLowerCase().replace(' ', '-') : 'full-time';
    const locationType = data.locationType || (data.location && data.location.toLowerCase().includes('remote') ? 'remote' : 'on-site');
    const location = data.location || 'Remote';
    const description = data.description || 'Job details and opportunities provided by KnotNex partner.';
    const requirements = Array.isArray(data.requirements) ? data.requirements : (Array.isArray(data.skills) ? data.skills : []);
    const responsibilities = Array.isArray(data.responsibilities) ? data.responsibilities : [];
    const accommodations = Array.isArray(data.disabilityAccommodations) ? data.disabilityAccommodations : (Array.isArray(data.accommodations) ? data.accommodations : []);
    const initialStatus = data.status || JobStatus.PENDING_VERIFICATION;

    try {
      const res = await query(
        `INSERT INTO jobs (
          org_id, created_by, title, department, type, location_type, location,
          description, requirements, responsibilities, disability_accommodations,
          min_salary, max_salary, currency, experience_level, education_level,
          deadline, status, is_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          orgId,
          userId,
          title,
          department,
          type,
          locationType,
          location,
          description,
          requirements,
          responsibilities,
          accommodations,
          data.minSalary || null,
          data.maxSalary || null,
          data.currency || 'INR',
          data.experienceLevel || data.experience || null,
          data.educationLevel || data.education || null,
          data.deadline || null,
          initialStatus,
          initialStatus === JobStatus.OPEN,
        ]
      );

      const created = res.rows[0];
      inMemoryJobs.unshift(created);
      return created;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const devJob = {
          id: `job-${Date.now()}`,
          org_id: orgId,
          created_by: userId,
          title,
          department,
          type,
          location_type: locationType,
          location,
          description,
          requirements,
          responsibilities,
          disability_accommodations: accommodations,
          min_salary: data.minSalary || null,
          max_salary: data.maxSalary || null,
          currency: data.currency || 'INR',
          status: initialStatus,
          is_verified: initialStatus === JobStatus.OPEN,
          applicants_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryJobs.unshift(devJob);
        return devJob;
      }
      throw err;
    }
  }

  static async listJobs(params: {
    page?: any;
    limit?: any;
    type?: string;
    locationType?: string;
    status?: string;
    orgId?: string;
    search?: string;
  }) {
    const { page, limit, offset } = getPagination(params);

    try {
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
      } else if (!params.orgId) {
        conditions.push(`j.status = 'open'`);
      }
      if (params.orgId) {
        conditions.push(`j.org_id = $${idx++}`);
        values.push(params.orgId);
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
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        let filtered = [...inMemoryJobs];
        if (params.orgId) {
          filtered = filtered.filter(j => j.org_id === params.orgId);
        }
        if (params.status) {
          filtered = filtered.filter(j => j.status === params.status);
        } else if (!params.orgId) {
          filtered = filtered.filter(j => j.status === 'open');
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }
      throw err;
    }
  }

  static async getJobById(id: string) {
    try {
      const res = await query(
        `SELECT j.*, o.name as org_name, o.logo_url as org_logo, o.about as org_about, o.website as org_website
         FROM jobs j
         JOIN organizations o ON j.org_id = o.id
         WHERE j.id = $1`,
        [id]
      );
      return res.rows[0] || null;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        return inMemoryJobs.find((j: any) => String(j.id) === String(id)) || null;
      }
      throw err;
    }
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

    try {
      const res = await query(
        `UPDATE jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );

      return res.rows[0];
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const job = inMemoryJobs.find((j: any) => String(j.id) === String(id));
        if (job) {
          Object.assign(job, data, { updated_at: new Date().toISOString() });
          return job;
        }
      }
      throw err;
    }
  }

  static async deleteJob(id: string) {
    try {
      await query(`DELETE FROM jobs WHERE id = $1`, [id]);
      return { success: true };
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const idx = inMemoryJobs.findIndex((j: any) => String(j.id) === String(id));
        if (idx !== -1) inMemoryJobs.splice(idx, 1);
        return { success: true };
      }
      throw err;
    }
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
