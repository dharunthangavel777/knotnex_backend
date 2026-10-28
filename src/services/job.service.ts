import { query } from '../config/database';
import { config } from '../config';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { JobStatus } from '../types/enums';

export const inMemoryJobs: any[] = [];

export function formatJobResponse(row: any) {
  if (!row) return null;
  const parseJson = (val: any, fallback: any = null) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  const recruiterInfo = parseJson(row.recruiter_info, {});
  const appFormConfig = parseJson(row.application_form_config, {});
  const faqs = parseJson(row.faqs, []);

  const minSal = row.min_salary != null ? Number(row.min_salary) : null;
  const maxSal = row.max_salary != null ? Number(row.max_salary) : null;
  let salaryRange = 'Competitive';
  if (minSal != null && maxSal != null) {
    salaryRange = `₹${minSal.toLocaleString('en-IN')} - ₹${maxSal.toLocaleString('en-IN')} / mo`;
  } else if (minSal != null) {
    salaryRange = `₹${minSal.toLocaleString('en-IN')}+ / mo`;
  }

  const locType = (row.location_type || 'on-site').toLowerCase();
  let workMode = 'Onsite';
  if (locType === 'remote') {
    workMode = 'Remote';
  } else if (locType === 'hybrid') {
    workMode = 'Hybrid';
  }

  const requirements = Array.isArray(row.requirements) ? row.requirements : [];
  const responsibilities = Array.isArray(row.responsibilities) ? row.responsibilities : [];
  const benefits = Array.isArray(row.benefits) && row.benefits.length > 0
    ? row.benefits
    : ['Health insurance', 'Flexible hours', 'Accessible workplace'];
  const accommodations = Array.isArray(row.disability_accommodations) ? row.disability_accommodations : [];

  return {
    ...row,
    benefits,
    recruiter_info: recruiterInfo,
    application_form_config: appFormConfig,
    faqs,

    // Flutter JobModel & Admin JobModel Direct Parity Fields
    companyName: row.org_name || 'KnotNex Partner',
    companyLogoUrl: row.org_logo || '',
    isVerified: Boolean(row.is_verified),
    jobType: row.type || 'Full-time',
    salaryRange,
    experienceRequired: row.experience_level || '1-3 years',
    skillsRequired: requirements,
    skills: requirements,
    responsibilities,
    accessibilitySupport: accommodations,
    accommodations,
    workMode,
    companyProfile: row.org_about || row.description || '',
    recruiter: {
      name: recruiterInfo.name || row.recruiter_name || 'Hiring Team',
      title: recruiterInfo.title || row.recruiter_title || 'Recruiter',
      avatar: recruiterInfo.avatar || row.recruiter_avatar || '',
    },
    recruiterName: recruiterInfo.name || row.recruiter_name || 'Hiring Team',
    recruiterRole: recruiterInfo.title || row.recruiter_title || 'Recruiter',
  };
}

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
    const benefits = Array.isArray(data.benefits) ? data.benefits : (Array.isArray(data.perks) ? data.perks : []);
    const recruiterInfo = JSON.stringify(data.recruiterInfo || data.recruiter || {});
    const formConfig = JSON.stringify(data.applicationFormConfig || data.formConfig || {});
    const faqs = JSON.stringify(data.faqs || []);
    const initialStatus = data.status || JobStatus.PENDING_VERIFICATION;

    try {
      const res = await query(
        `INSERT INTO jobs (
          org_id, created_by, title, department, type, location_type, location,
          description, requirements, responsibilities, disability_accommodations,
          min_salary, max_salary, currency, experience_level, education_level,
          deadline, status, is_verified, benefits, recruiter_info, application_form_config, faqs
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23
        ) RETURNING *`,
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
          benefits,
          recruiterInfo,
          formConfig,
          faqs,
        ]
      );

      const created = res.rows[0];
      inMemoryJobs.unshift(created);
      return formatJobResponse(created);
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
          benefits,
          recruiter_info: data.recruiterInfo || data.recruiter || {},
          application_form_config: data.applicationFormConfig || {},
          faqs: data.faqs || [],
          applicants_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryJobs.unshift(devJob);
        return formatJobResponse(devJob);
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
        `SELECT j.*, o.name as org_name, o.logo_url as org_logo, o.website as org_website
         FROM jobs j
         JOIN organizations o ON j.org_id = o.id
         ${whereClause}
         ORDER BY j.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      const formatted = jobsRes.rows.map(r => formatJobResponse(r));
      return buildPaginatedResult(formatted, total, page, limit);
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
        const formatted = filtered.map(j => formatJobResponse(j));
        return buildPaginatedResult(formatted, formatted.length, page, limit);
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
      return res.rows[0] ? formatJobResponse(res.rows[0]) : null;
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const found = inMemoryJobs.find((j: any) => String(j.id) === String(id));
        return found ? formatJobResponse(found) : null;
      }
      throw err;
    }
  }

  static async updateJob(id: string, data: any) {
    const allowed = [
      'title', 'department', 'type', 'location_type', 'location', 'description',
      'requirements', 'responsibilities', 'disability_accommodations', 'min_salary',
      'max_salary', 'currency', 'experience_level', 'education_level', 'deadline', 'status',
      'is_verified', 'benefits', 'recruiter_info', 'application_form_config', 'faqs'
    ];

    const jsonbFields = ['recruiter_info', 'application_form_config', 'faqs'];

    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      const val = data[camel] !== undefined ? data[camel] : data[key];
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        if (jsonbFields.includes(key)) {
          values.push(typeof val === 'string' ? val : JSON.stringify(val));
        } else {
          values.push(val);
        }
      }
    }

    if (fields.length === 0) return this.getJobById(id);

    fields.push('updated_at = NOW()');

    try {
      const res = await query(
        `UPDATE jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );

      return formatJobResponse(res.rows[0]);
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const job = inMemoryJobs.find((j: any) => String(j.id) === String(id));
        if (job) {
          Object.assign(job, data, { updated_at: new Date().toISOString() });
          return formatJobResponse(job);
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
      `SELECT j.*, o.name as org_name, o.logo_url as org_logo, o.website as org_website
       FROM jobs j
       JOIN organizations o ON j.org_id = o.id
       WHERE j.id != $1 AND (j.type = $2 OR j.location_type = $3) AND j.status = 'open'
       ORDER BY j.created_at DESC
       LIMIT 4`,
      [jobId, current.type, current.location_type]
    );

    return res.rows.map(r => formatJobResponse(r));
  }
}
