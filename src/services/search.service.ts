import { query } from '../config/database';

export class SearchService {
  static async universalSearch(searchTerm: string) {
    const term = `%${searchTerm}%`;

    const events = await query(
      `SELECT id, title, category, type, event_date, cover_url, 'event' as type
       FROM events
       WHERE title ILIKE $1 OR short_description ILIKE $1
       LIMIT 5`,
      [term]
    );

    const jobs = await query(
      `SELECT id, title, type, location, 'job' as type
       FROM jobs
       WHERE title ILIKE $1 OR description ILIKE $1
       LIMIT 5`,
      [term]
    );

    const orgs = await query(
      `SELECT id, name, type, logo_url, 'organization' as type
       FROM organizations
       WHERE name ILIKE $1 OR about ILIKE $1
       LIMIT 5`,
      [term]
    );

    const schemes = await query(
      `SELECT id, title, type, category, provider_name, 'scheme' as type
       FROM schemes
       WHERE title ILIKE $1 OR description ILIKE $1
       LIMIT 5`,
      [term]
    );

    return {
      query: searchTerm,
      events: events.rows,
      jobs: jobs.rows,
      organizations: orgs.rows,
      schemes: schemes.rows,
    };
  }
}
