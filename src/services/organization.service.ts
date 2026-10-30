import { config } from '../config';
import { inMemoryJobs } from './job.service';
import { inMemorySchemes } from './scheme.service';
import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import { generateSlug } from '../utils/slug.util';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';

const inMemoryOrgCampaigns: any[] = [];
const inMemoryOrgAchievements: any[] = [];

export class OrganizationService {
  static async createOrg(ownerId: string, data: any) {
    const slug = generateSlug(data.name);

    const res = await query(
      `INSERT INTO organizations (
        owner_id, name, slug, type, about, mission, vision, services, contact_email, contact_phone, website, social_links, logo_url, cover_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        ownerId,
        data.name,
        slug,
        data.type,
        data.about || null,
        data.mission || null,
        data.vision || null,
        data.services || [],
        data.contactEmail || null,
        data.contactPhone || null,
        data.website || null,
        JSON.stringify(data.socialLinks || {}),
        data.logoUrl || null,
        data.coverUrl || null,
      ]
    );

    const org = res.rows[0];

    // Add owner to team members as Lead
    await query(
      `INSERT INTO org_team_members (org_id, user_id, role_in_org, permissions)
       VALUES ($1, $2, 'Owner', ARRAY['admin', 'all'])`,
      [org.id, ownerId]
    );

    return org;
  }

  static async listOrgs(params: { page?: any; limit?: any; type?: string; search?: string }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.type) {
      conditions.push(`type = $${idx++}`);
      values.push(params.type);
    }
    if (params.search) {
      conditions.push(`(name ILIKE $${idx} OR about ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(`SELECT COUNT(*) FROM organizations ${whereClause}`, values);
      const total = parseInt(countRes.rows[0].count, 10);

      const orgsRes = await query(
        `SELECT * FROM organizations ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      return buildPaginatedResult(orgsRes.rows, total, page, limit);
    } catch (err: any) {
      console.warn('[OrganizationService.listOrgs] DB unreachable, returning dev organization:', err.message);
      const devOrgs = [
        {
          id: '20000000-0000-0000-0000-000000000001',
          owner_id: '00000000-0000-0000-0000-000000000001',
          name: 'Ability First Foundation',
          slug: 'ability-first-foundation',
          type: 'NGO',
          about: 'Dedicated to empowering individuals through accessible technology, inclusion workshops, and community-driven innovation initiatives across the globe.',
          mission: 'To create an inclusive world for every individual.',
          vision: 'Zero barriers in accessibility, employment, and education.',
          services: ['Assistive Technology', 'Job Training', 'Event Sponsorship'],
          contact_email: 'contact@abilityfirst.org',
          contact_phone: '+91 98765 43210',
          website: 'https://abilityfirst.org',
          is_verified: true,
          followers_count: 1420,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      return buildPaginatedResult(devOrgs, devOrgs.length, page, limit);
    }
  }

  static async getOrgById(id: string) {
    try {
      const res = await query(`SELECT * FROM organizations WHERE id = $1`, [id]);
      if (res.rows[0]) return res.rows[0];
    } catch (_) {}
    return {
      id: id || '20000000-0000-0000-0000-000000000001',
      owner_id: '00000000-0000-0000-0000-000000000001',
      name: 'Ability First Foundation',
      slug: 'ability-first-foundation',
      type: 'NGO',
      about: 'Dedicated to empowering individuals through accessible technology, inclusion workshops, and community-driven innovation initiatives across the globe.',
      mission: 'To create an inclusive world for every individual.',
      vision: 'Zero barriers in accessibility, employment, and education.',
      services: ['Assistive Technology', 'Job Training', 'Event Sponsorship'],
      contact_email: 'contact@abilityfirst.org',
      contact_phone: '+91 98765 43210',
      website: 'https://abilityfirst.org',
      is_verified: true,
      followers_count: 1420,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static async updateOrg(id: string, data: any) {
    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    const allowed = ['name', 'type', 'about', 'mission', 'vision', 'services', 'achievements', 'contact_email', 'contact_phone', 'website', 'logo_url', 'cover_url'];
    
    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      if (data[camel] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[camel]);
      }
    }

    if (fields.length === 0) return this.getOrgById(id);

    fields.push('updated_at = NOW()');

    const res = await query(
      `UPDATE organizations SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return res.rows[0];
  }

  static async followOrg(orgId: string, userId: string) {
    await query(
      `INSERT INTO org_followers (org_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [orgId, userId]
    );
    await query(
      `UPDATE organizations SET followers_count = (SELECT COUNT(*) FROM org_followers WHERE org_id = $1) WHERE id = $1`,
      [orgId]
    );
    return { followed: true };
  }

  static async unfollowOrg(orgId: string, userId: string) {
    await query(`DELETE FROM org_followers WHERE org_id = $1 AND user_id = $2`, [orgId, userId]);
    await query(
      `UPDATE organizations SET followers_count = (SELECT COUNT(*) FROM org_followers WHERE org_id = $1) WHERE id = $1`,
      [orgId]
    );
    return { followed: false };
  }

  static async addReview(orgId: string, userId: string, rating: number, comment?: string) {
    const res = await query(
      `INSERT INTO org_reviews (org_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
       RETURNING *`,
      [orgId, userId, rating, comment || null]
    );
    return res.rows[0];
  }

  static async getOrgReviews(orgId: string) {
    const res = await query(
      `SELECT r.*, u.full_name, u.avatar_url
       FROM org_reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.org_id = $1
       ORDER BY r.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }

  static async getOrgEvents(orgId: string, params: { page?: any; limit?: any; status?: string }) {
    const { page, limit, offset } = getPagination(params);

    try {
      let resolvedOrgId: string | null = null;
      let resolvedUserId: string | null = null;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId || '');
      if (isUuid) {
        resolvedOrgId = orgId;
        resolvedUserId = orgId;
        const orgRecord = await query(
          `SELECT id, owner_id FROM organizations WHERE id = $1 OR owner_id = $1 LIMIT 1`,
          [orgId]
        );
        if (orgRecord.rows[0]) {
          resolvedOrgId = orgRecord.rows[0].id;
          resolvedUserId = orgRecord.rows[0].owner_id || resolvedUserId;
        }
      } else if (orgId) {
        const hex = orgId.replace(/^org-/i, '').trim().toLowerCase();
        const matchRes = await query(
          `SELECT o.id as org_id, o.owner_id as user_id 
           FROM organizations o 
           WHERE o.id::text ILIKE $1 OR o.owner_id::text ILIKE $1
           LIMIT 1`,
          [`${hex}%`]
        );
        if (matchRes.rows[0]) {
          resolvedOrgId = matchRes.rows[0].org_id;
          resolvedUserId = matchRes.rows[0].user_id;
        } else {
          const userMatch = await query(
            `SELECT id FROM users WHERE id::text ILIKE $1 LIMIT 1`,
            [`${hex}%`]
          );
          if (userMatch.rows[0]) {
            resolvedUserId = userMatch.rows[0].id;
            const orgByOwner = await query(
              `SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1`,
              [resolvedUserId]
            );
            if (orgByOwner.rows[0]) {
              resolvedOrgId = orgByOwner.rows[0].id;
            }
          }
        }
      }

      const countRes = await query(
        `SELECT COUNT(*) FROM events 
         WHERE (
           ($1::uuid IS NOT NULL AND (org_id = $1 OR created_by = $1))
           OR ($2::uuid IS NOT NULL AND (org_id = $2 OR created_by = $2))
         )`,
        [resolvedOrgId, resolvedUserId]
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const res = await query(
        `SELECT e.*,
                COALESCE((SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id), 0) AS registration_count,
                COALESCE((SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL), 0) AS checked_in_count
         FROM events e
         WHERE (
           ($1::uuid IS NOT NULL AND (e.org_id = $1 OR e.created_by = $1))
           OR ($2::uuid IS NOT NULL AND (e.org_id = $2 OR e.created_by = $2))
         )
         ORDER BY e.event_date DESC, e.created_at DESC
         LIMIT $3 OFFSET $4`,
        [resolvedOrgId, resolvedUserId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      console.warn('[getOrgEvents] Notice:', err.message);
      try {
        const storeFile = path.resolve(process.cwd(), 'src/db/dev_events_store.json');
        if (fs.existsSync(storeFile)) {
          const allEvts: any[] = JSON.parse(fs.readFileSync(storeFile, 'utf8')) || [];
          return buildPaginatedResult(allEvts, allEvts.length, page, limit);
        }
      } catch (_) {}
      return buildPaginatedResult([], 0, page, limit);
    }
  }

  static async getOrgJobs(orgId: string, params: { page?: any; limit?: any; status?: string }) {
    const { page, limit, offset } = getPagination(params);

    try {
      let resolvedOrgId: string | null = null;
      let resolvedUserId: string | null = null;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId || '');
      if (isUuid) {
        resolvedOrgId = orgId;
        resolvedUserId = orgId;
        const orgRecord = await query(
          `SELECT id, owner_id FROM organizations WHERE id = $1 OR owner_id = $1 LIMIT 1`,
          [orgId]
        );
        if (orgRecord.rows[0]) {
          resolvedOrgId = orgRecord.rows[0].id;
          resolvedUserId = orgRecord.rows[0].owner_id || resolvedUserId;
        }
      } else if (orgId) {
        const hex = orgId.replace(/^org-/i, '').trim().toLowerCase();
        const matchRes = await query(
          `SELECT o.id as org_id, o.owner_id as user_id 
           FROM organizations o 
           WHERE o.id::text ILIKE $1 OR o.owner_id::text ILIKE $1
           LIMIT 1`,
          [`${hex}%`]
        );
        if (matchRes.rows[0]) {
          resolvedOrgId = matchRes.rows[0].org_id;
          resolvedUserId = matchRes.rows[0].user_id;
        }
      }

      if (!resolvedOrgId && !resolvedUserId) {
        resolvedOrgId = '20000000-0000-0000-0000-000000000001';
      }

      const countRes = await query(
        `SELECT COUNT(*) FROM jobs 
         WHERE (
           ($1::uuid IS NOT NULL AND (org_id = $1 OR created_by = $1))
           OR ($2::uuid IS NOT NULL AND (org_id = $2 OR created_by = $2))
         )`,
        [resolvedOrgId, resolvedUserId]
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const res = await query(
        `SELECT j.*,
                o.name as org_name, o.logo_url as org_logo,
                COALESCE((SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id), 0) AS applications_count
         FROM jobs j
         LEFT JOIN organizations o ON j.org_id = o.id
         WHERE (
           ($1::uuid IS NOT NULL AND (j.org_id = $1 OR j.created_by = $1))
           OR ($2::uuid IS NOT NULL AND (j.org_id = $2 OR j.created_by = $2))
         )
         ORDER BY j.created_at DESC
         LIMIT $3 OFFSET $4`,
        [resolvedOrgId, resolvedUserId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      console.warn('[getOrgJobs] DB Notice:', err.message);
      if (config.env === 'development' || !config.isProduction) {
        return buildPaginatedResult(inMemoryJobs, inMemoryJobs.length, page, limit);
      }
      return buildPaginatedResult([], 0, page, limit);
    }
  }

  static async getOrgSchemes(orgId: string, params: { page?: any; limit?: any }) {
    const { page, limit, offset } = getPagination(params);

    try {
      let resolvedOrgId: string | null = null;
      let resolvedUserId: string | null = null;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId || '');
      if (isUuid) {
        resolvedOrgId = orgId;
        resolvedUserId = orgId;
        const orgRecord = await query(
          `SELECT id, owner_id FROM organizations WHERE id = $1 OR owner_id = $1 LIMIT 1`,
          [orgId]
        );
        if (orgRecord.rows[0]) {
          resolvedOrgId = orgRecord.rows[0].id;
          resolvedUserId = orgRecord.rows[0].owner_id || resolvedUserId;
        }
      } else if (orgId) {
        const hex = orgId.replace(/^org-/i, '').trim().toLowerCase();
        const matchRes = await query(
          `SELECT o.id as org_id, o.owner_id as user_id 
           FROM organizations o 
           WHERE o.id::text ILIKE $1 OR o.owner_id::text ILIKE $1
           LIMIT 1`,
          [`${hex}%`]
        );
        if (matchRes.rows[0]) {
          resolvedOrgId = matchRes.rows[0].org_id;
          resolvedUserId = matchRes.rows[0].user_id;
        }
      }

      if (!resolvedOrgId && !resolvedUserId) {
        resolvedOrgId = '20000000-0000-0000-0000-000000000001';
      }

      const countRes = await query(
        `SELECT COUNT(*) FROM schemes 
         WHERE (
           ($1::uuid IS NOT NULL AND (org_id = $1 OR created_by = $1))
           OR ($2::uuid IS NOT NULL AND (org_id = $2 OR created_by = $2))
         )`,
        [resolvedOrgId, resolvedUserId]
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const res = await query(
        `SELECT s.*,
                o.name as org_name, o.logo_url as org_logo,
                COALESCE((SELECT COUNT(*) FROM scheme_applications sa WHERE sa.scheme_id = s.id), 0) AS applications_count
         FROM schemes s
         LEFT JOIN organizations o ON s.org_id = o.id
         WHERE (
           ($1::uuid IS NOT NULL AND (s.org_id = $1 OR s.created_by = $1))
           OR ($2::uuid IS NOT NULL AND (s.org_id = $2 OR s.created_by = $2))
         )
         ORDER BY s.created_at DESC
         LIMIT $3 OFFSET $4`,
        [resolvedOrgId, resolvedUserId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      console.warn('[getOrgSchemes] DB Notice:', err.message);
      if (config.env === 'development' || !config.isProduction) {
        return buildPaginatedResult(inMemorySchemes, inMemorySchemes.length, page, limit);
      }
      return buildPaginatedResult([], 0, page, limit);
    }
  }

  static async getOrgRegistrations(orgId: string, params: { page?: any; limit?: any; status?: string; search?: string }) {
    const { page, limit, offset } = getPagination(params);

    try {
      const countRes = await query(
        `SELECT COUNT(*)
         FROM event_registrations r
         JOIN events e ON r.event_id = e.id
         WHERE e.org_id = $1`,
        [orgId]
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const res = await query(
        `SELECT r.*,
                e.title AS event_title,
                e.event_date,
                e.start_time,
                e.venue_name,
                e.ticket_price,
                e.is_free,
                u.full_name AS user_name,
                u.avatar_url AS user_avatar,
                u.email AS user_email
         FROM event_registrations r
         JOIN events e ON r.event_id = e.id
         LEFT JOIN users u ON r.user_id = u.id
         WHERE e.org_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [orgId, limit, offset]
      );

      return buildPaginatedResult(res.rows, total, page, limit);
    } catch (err: any) {
      return buildPaginatedResult([], 0, page, limit);
    }
  }

  static async getOrgCampaigns(orgId: string) {
    try {
      const res = await query(
        `SELECT * FROM org_campaigns WHERE org_id = $1 ORDER BY created_at DESC`,
        [orgId]
      );
      return res.rows;
    } catch {
      return inMemoryOrgCampaigns.filter(c => c.org_id === orgId);
    }
  }

  static async createOrgCampaign(orgId: string, data: any) {
    const title = data.title || data.name || 'Untitled Campaign';
    const goal = data.goal ? Number(data.goal) : 50000;
    const audience = data.audience || 'Target Community';
    const desc = data.desc || data.description || '';
    const spend = data.spend || '₹0';
    const reach = data.reach || '0';
    const conversions = data.conversions || 0;

    try {
      const res = await query(
        `INSERT INTO org_campaigns (org_id, title, goal, audience, description, spend, reach, conversions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [orgId, title, goal, audience, desc, spend, reach, conversions]
      );
      return res.rows[0];
    } catch {
      const newCamp = {
        id: `camp-${Date.now()}`,
        org_id: orgId,
        title,
        goal,
        audience,
        description: desc,
        spend,
        reach,
        conversions,
        status: 'active',
        created_at: new Date().toISOString()
      };
      inMemoryOrgCampaigns.unshift(newCamp);
      return newCamp;
    }
  }

  static async deleteOrgCampaign(orgId: string, campaignId: string) {
    try {
      await query(`DELETE FROM org_campaigns WHERE id = $1 AND org_id = $2`, [campaignId, orgId]);
      return { success: true };
    } catch {
      const idx = inMemoryOrgCampaigns.findIndex(c => c.id === campaignId);
      if (idx !== -1) inMemoryOrgCampaigns.splice(idx, 1);
      return { success: true };
    }
  }

  static async getOrgAchievements(orgId: string) {
    try {
      const res = await query(
        `SELECT * FROM org_achievements WHERE org_id = $1 ORDER BY created_at DESC`,
        [orgId]
      );
      return res.rows;
    } catch {
      return inMemoryOrgAchievements.filter(a => a.org_id === orgId);
    }
  }

  static async createOrgAchievement(orgId: string, data: any) {
    const title = data.title || 'Untitled Achievement';
    const date = data.date || '2026';
    const body = data.body || 'Awarding Body';
    const desc = data.desc || data.description || '';
    const badge = data.badge || 'star';

    try {
      const res = await query(
        `INSERT INTO org_achievements (org_id, title, date, body, description, badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [orgId, title, date, body, desc, badge]
      );
      return res.rows[0];
    } catch {
      const newAch = {
        id: `ach-${Date.now()}`,
        org_id: orgId,
        title,
        date,
        body,
        description: desc,
        badge,
        created_at: new Date().toISOString()
      };
      inMemoryOrgAchievements.unshift(newAch);
      return newAch;
    }
  }

  static async deleteOrgAchievement(orgId: string, achId: string) {
    try {
      await query(`DELETE FROM org_achievements WHERE id = $1 AND org_id = $2`, [achId, orgId]);
      return { success: true };
    } catch {
      const idx = inMemoryOrgAchievements.findIndex(a => a.id === achId);
      if (idx !== -1) inMemoryOrgAchievements.splice(idx, 1);
      return { success: true };
    }
  }

  static async getOrgJobApplications(orgId: string, params: { page?: any; limit?: any; status?: string }) {
    const { page, limit, offset } = getPagination(params);
    try {
      const countRes = await query(
        `SELECT COUNT(*) FROM job_applications a JOIN jobs j ON a.job_id = j.id WHERE j.org_id = $1`,
        [orgId]
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const res = await query(
        `SELECT a.*,
                j.title as job_title,
                j.department as job_department,
                u.full_name as user_name,
                u.full_name,
                u.email as user_email,
                u.email,
                u.phone,
                u.avatar_url
         FROM job_applications a
         JOIN jobs j ON a.job_id = j.id
         JOIN users u ON a.applicant_id = u.id
         WHERE j.org_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [orgId, limit, offset]
      );
      return buildPaginatedResult(res.rows, total, page, limit);
    } catch {
      return buildPaginatedResult([], 0, page, limit);
    }
  }

  static async getOrgSchemeApplications(orgId: string, params?: { page?: any; limit?: any }) {
    const { page, limit, offset } = getPagination(params || {});
    try {
      const countRes = await query(
        `SELECT COUNT(*) FROM scheme_applications sa JOIN schemes s ON sa.scheme_id = s.id WHERE s.org_id = $1`,
        [orgId]
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const res = await query(
        `SELECT sa.*,
                s.title as scheme_title,
                s.category as scheme_category,
                u.full_name as applicant,
                u.full_name,
                u.email,
                u.phone,
                u.avatar_url
         FROM scheme_applications sa
         JOIN schemes s ON sa.scheme_id = s.id
         JOIN users u ON sa.applicant_id = u.id
         WHERE s.org_id = $1
         ORDER BY sa.created_at DESC
         LIMIT $2 OFFSET $3`,
        [orgId, limit, offset]
      );
      return buildPaginatedResult(res.rows, total, page, limit);
    } catch {
      return buildPaginatedResult([], 0, page, limit);
    }
  }
}
