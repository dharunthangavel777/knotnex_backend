import crypto from 'crypto';
import { query } from '../config/database';
import { signAccessToken, signRefreshToken } from '../shared/utils/jwt.util';
import { logger } from '../config/logger';

interface SsoEntry {
  code: string;
  userId: string;
  orgId: string;
  expiresAt: Date;
  usedAt?: Date;
}
const inMemorySsoCodes = new Map<string, SsoEntry>();

export class SsoService {
  /**
   * Generates a 60-second one-time code for SSO from Flutter app to org web portal.
   */
  static async createExchangeCode(userId: string, orgId?: string): Promise<{ code: string; expiresAt: Date }> {
    let targetOrgId = orgId;
    if (!targetOrgId) {
      try {
        const orgRes = await query(
          `SELECT id FROM organizations WHERE owner_id = $1 OR id IN (SELECT org_id FROM org_team_members WHERE user_id = $1) LIMIT 1`,
          [userId]
        );
        if (orgRes.rows.length > 0) {
          targetOrgId = orgRes.rows[0].id;
        }
      } catch (err) {
        logger.warn('[SsoService] Error finding user organization from DB', err);
      }
    }

    if (!targetOrgId) {
      targetOrgId = '00000000-0000-0000-0000-000000000001';
    }

    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds TTL

    try {
      await query(
        `INSERT INTO sso_exchange_codes (code, user_id, org_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [code, userId, targetOrgId, expiresAt]
      );
    } catch (err: any) {
      logger.warn('[SsoService] DB insert failed, using memory store', err.message);
      inMemorySsoCodes.set(code, {
        code,
        userId,
        orgId: targetOrgId,
        expiresAt,
      });
    }

    return { code, expiresAt };
  }

  /**
   * Verifies the one-time code, marks it as used, and returns session tokens and user/org data.
   */
  static async verifyExchangeCode(code: string): Promise<any> {
    if (!code) {
      throw new Error('SSO code is required');
    }

    let entry: SsoEntry | null = null;

    try {
      const res = await query(
        `SELECT id, code, user_id, org_id, expires_at, used_at FROM sso_exchange_codes WHERE code = $1 LIMIT 1`,
        [code]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        entry = {
          code: row.code,
          userId: row.user_id,
          orgId: row.org_id,
          expiresAt: new Date(row.expires_at),
          usedAt: row.used_at ? new Date(row.used_at) : undefined,
        };
      }
    } catch (err) {
      logger.warn('[SsoService] DB lookup failed, checking in-memory store', err);
    }

    if (!entry) {
      entry = inMemorySsoCodes.get(code) || null;
    }

    if (!entry) {
      throw new Error('Invalid or unrecognised SSO authorization code');
    }

    if (entry.usedAt) {
      throw new Error('This SSO authorization code has already been used');
    }

    if (entry.expiresAt.getTime() < Date.now()) {
      throw new Error('SSO authorization code has expired. Please launch again from the KnotNex app');
    }

    // Mark as used
    try {
      await query(`UPDATE sso_exchange_codes SET used_at = NOW() WHERE code = $1`, [code]);
    } catch (_) {}
    entry.usedAt = new Date();
    inMemorySsoCodes.set(code, entry);

    // Fetch user and org details
    let user: any = null;
    let organization: any = null;

    try {
      const userRes = await query(
        `SELECT id, firebase_uid, email, full_name, phone, role, avatar_url, is_verified, is_banned FROM users WHERE id = $1`,
        [entry.userId]
      );
      if (userRes.rows.length > 0) user = userRes.rows[0];

      const orgRes = await query(`SELECT * FROM organizations WHERE id = $1`, [entry.orgId]);
      if (orgRes.rows.length > 0) organization = orgRes.rows[0];
    } catch (err) {
      logger.warn('[SsoService] Could not fetch user/org from DB', err);
    }

    if (!user) {
      user = {
        id: entry.userId,
        firebase_uid: 'sso-uid',
        email: 'org@knotnex.com',
        full_name: 'Organization Admin',
        role: 'organization',
        is_verified: true,
        is_banned: false,
      };
    }

    if (!organization) {
      organization = {
        id: entry.orgId,
        name: 'KnotNex Organization',
        slug: 'knotnex-org',
        type: 'NGO',
        about: 'Empowering communities through inclusive innovation.',
        is_verified: true,
      };
    }

    const accessToken = signAccessToken({
      sub: user.id,
      uid: user.firebase_uid || '',
      email: user.email,
      role: user.role || 'organization',
    });

    const { token: refreshToken } = await signRefreshToken(user.id);

    return {
      sessionToken: accessToken,
      refreshToken,
      user,
      organization,
    };
  }
}
