import { query } from '../config/database';
import { generateSlug } from '../utils/slug.util';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';

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

    const countRes = await query(`SELECT COUNT(*) FROM organizations ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const orgsRes = await query(
      `SELECT * FROM organizations ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return buildPaginatedResult(orgsRes.rows, total, page, limit);
  }

  static async getOrgById(id: string) {
    const res = await query(`SELECT * FROM organizations WHERE id = $1`, [id]);
    return res.rows[0] || null;
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
}
