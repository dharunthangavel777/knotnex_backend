import { query } from '../config/database';

export class AnalyticsService {
  static async getPlatformDashboard() {
    const usersCount = await query(`SELECT COUNT(*) FROM users`);
    const orgsCount = await query(`SELECT COUNT(*) FROM organizations`);
    const eventsCount = await query(`SELECT COUNT(*) FROM events`);
    const registrationsCount = await query(`SELECT COUNT(*) FROM event_registrations`);
    const jobsCount = await query(`SELECT COUNT(*) FROM jobs`);
    const applicationsCount = await query(`SELECT COUNT(*) FROM job_applications`);
    const schemesCount = await query(`SELECT COUNT(*) FROM schemes`);

    return {
      overview: {
        totalUsers: parseInt(usersCount.rows[0].count, 10),
        totalOrganizations: parseInt(orgsCount.rows[0].count, 10),
        totalEvents: parseInt(eventsCount.rows[0].count, 10),
        totalRegistrations: parseInt(registrationsCount.rows[0].count, 10),
        totalJobs: parseInt(jobsCount.rows[0].count, 10),
        totalApplications: parseInt(applicationsCount.rows[0].count, 10),
        totalSchemes: parseInt(schemesCount.rows[0].count, 10),
      },
    };
  }

  static async getOrgDashboard(orgId: string) {
    const events = await query(`SELECT COUNT(*) FROM events WHERE org_id = $1`, [orgId]);
    const jobs = await query(`SELECT COUNT(*) FROM jobs WHERE org_id = $1`, [orgId]);
    const applications = await query(
      `SELECT COUNT(*) FROM job_applications a JOIN jobs j ON a.job_id = j.id WHERE j.org_id = $1`,
      [orgId]
    );
    const followers = await query(`SELECT followers_count FROM organizations WHERE id = $1`, [orgId]);

    return {
      totalEvents: parseInt(events.rows[0].count, 10),
      totalJobs: parseInt(jobs.rows[0].count, 10),
      totalApplications: parseInt(applications.rows[0].count, 10),
      totalFollowers: followers.rows[0]?.followers_count || 0,
    };
  }

  static async getAiScanInsights() {
    return {
      accessibilityComplianceScore: 94,
      highlights: [
        '92% of events have wheelchair accessibility enabled.',
        'High candidate response rate in remote tech jobs.',
        'Increased demand for sign language interpreter support in youth events.',
      ],
      recommendations: [
        'Promote more assistive tech skill development schemes.',
        'Partner with regional transport services for upcoming offline conclaves.',
      ],
    };
  }
}
