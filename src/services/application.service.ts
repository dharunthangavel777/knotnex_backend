import { query } from '../config/database';
import { PubSubIntegration } from '../integrations/gcp/pubsub.gcp';
import { TOPICS } from '../config/pubsub';
import { JobApplicationStage } from '../types/enums';
import { NotificationService } from './notification.service';

export class ApplicationService {
  static async submitApplication(userId: string, data: any) {
    const jobId = data.jobId || data.job_id;
    const resumeUrl = data.resumeUrl || data.resume_url || 'https://knotnex-media-prod.storage.googleapis.com/resumes/default_resume.pdf';
    const coverLetter = data.coverLetter || data.cover_letter || null;
    const portfolioUrl = data.portfolioUrl || data.portfolio_url || null;
    const accommodationNotes = data.accommodationNotes || data.accommodation_notes || null;

    // Check duplicate
    const existing = await query(
      `SELECT id FROM job_applications WHERE job_id = $1 AND applicant_id = $2`,
      [jobId, userId]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error('You have already applied for this job opening.');
    }

    const res = await query(
      `INSERT INTO job_applications (
        job_id, applicant_id, resume_url, cover_letter, portfolio_url, accommodation_notes, stage
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Applied')
      RETURNING *`,
      [jobId, userId, resumeUrl, coverLetter, portfolioUrl, accommodationNotes]
    );

    const application = res.rows[0];

    // Increment applicants_count on job
    await query(`UPDATE jobs SET applicants_count = applicants_count + 1 WHERE id = $1`, [jobId]);

    // Fetch job details for notification
    const jobRes = await query(`SELECT title FROM jobs WHERE id = $1`, [jobId]);
    const jobTitle = jobRes.rows[0]?.title || 'Job Position';

    // In-app notification
    NotificationService.createNotification(
      userId,
      null,
      'career',
      'Application Submitted',
      `Your application for "${jobTitle}" has been received.`,
      { jobId, applicationId: application.id }
    ).catch(() => {});

    // Publish event
    PubSubIntegration.publishMessage(TOPICS.JOB_APPLIED, {
      applicationId: application.id,
      jobId,
      applicantId: userId,
    });

    return application;
  }

  static async listApplicationsByJob(jobId: string) {
    const res = await query(
      `SELECT a.*, u.full_name, u.email, u.phone, u.avatar_url, p.disability_type
       FROM job_applications a
       JOIN users u ON a.applicant_id = u.id
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE a.job_id = $1
       ORDER BY a.created_at DESC`,
      [jobId]
    );
    return res.rows;
  }

  static async listApplicationsByUser(userId: string) {
    const res = await query(
      `SELECT a.*, j.title as job_title, j.type as job_type, j.location as job_location, o.name as org_name, o.logo_url as org_logo
       FROM job_applications a
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN organizations o ON j.org_id = o.id
       WHERE a.applicant_id = $1
       ORDER BY a.created_at DESC`,
      [userId]
    );
    return res.rows;
  }

  static async getApplicationById(id: string) {
    const res = await query(
      `SELECT a.*, j.title as job_title, j.type as job_type, j.location as job_location, o.name as org_name, o.logo_url as org_logo
       FROM job_applications a
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN organizations o ON j.org_id = o.id
       WHERE a.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async updateApplicationStage(id: string, stage: JobApplicationStage, reviewerNotes?: string) {
    const res = await query(
      `UPDATE job_applications
       SET stage = $1, reviewer_notes = COALESCE($2, reviewer_notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [stage, reviewerNotes || null, id]
    );

    const updated = res.rows[0];
    if (updated) {
      NotificationService.createNotification(
        updated.applicant_id,
        null,
        'career',
        'Application Update',
        `Your application status has been updated to "${stage}".`,
        { applicationId: updated.id }
      ).catch(() => {});
    }

    return updated;
  }

  static updateStage = ApplicationService.updateApplicationStage;
}
