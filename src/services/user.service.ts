import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { UserRole } from '../types/enums';
import { NotificationService } from './notification.service';
import { config } from '../config';
import { logger } from '../config/logger';

export class UserService {
  static async listUsers(params: { page?: any; limit?: any; role?: string; search?: string; status?: string }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.role) {
      conditions.push(`u.role = $${idx++}`);
      values.push(params.role);
    }

    if (params.status) {
      if (params.status === 'pending_verification') {
        conditions.push(`ovr.status = 'PENDING'`);
      } else if (params.status === 'banned') {
        conditions.push(`u.is_banned = TRUE`);
      } else if (params.status === 'suspended') {
        conditions.push(`(u.is_banned = TRUE OR u.is_verified = FALSE)`);
      } else if (params.status === 'active') {
        conditions.push(`u.is_banned = FALSE AND u.is_verified = TRUE`);
      }
    }

    if (params.search) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR ovr.organization_name ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(
        `SELECT COUNT(*) 
         FROM users u
         LEFT JOIN LATERAL (
           SELECT id, organization_name, category, organization_email, phone, website, status, rejection_reason
           FROM organization_verification_requests
           WHERE user_id = u.id
           ORDER BY created_at DESC
           LIMIT 1
         ) ovr ON TRUE
         ${whereClause}`,
        values
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const usersRes = await query(
        `SELECT 
           u.id, u.firebase_uid, u.email, u.phone, u.full_name, u.avatar_url, u.role, u.is_verified, u.is_banned, u.category_selection_completed, u.created_at,
           ovr.id as verification_request_id,
           ovr.organization_name,
           ovr.category as organization_category,
           ovr.organization_email,
           ovr.phone as organization_phone,
           ovr.website as organization_website,
           ovr.status as verification_status,
           ovr.rejection_reason,
           org.id as organization_id,
           org.name as registered_org_name,
           org.type as organization_type
         FROM users u
         LEFT JOIN LATERAL (
           SELECT id, organization_name, category, organization_email, phone, website, status, rejection_reason
           FROM organization_verification_requests
           WHERE user_id = u.id
           ORDER BY created_at DESC
           LIMIT 1
         ) ovr ON TRUE
         LEFT JOIN organizations org ON org.owner_id = u.id
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      return buildPaginatedResult(usersRes.rows, total, page, limit);
    } catch (dbErr: any) {
      logger.error('[UserService] PostgreSQL database query failed in listUsers:', dbErr);
      throw dbErr;
    }
  }

  static async getUserById(id: string, currentUserId?: string) {
    try {
      const res = await query(
        `SELECT u.id, u.firebase_uid, u.email, u.phone, u.full_name, u.avatar_url, u.role, u.is_verified, u.is_banned, u.category_selection_completed, u.created_at,
                p.bio, p.district, p.state, p.skills, p.languages, p.disability_type,
                ovr.id as verification_request_id,
                ovr.organization_name,
                ovr.category as organization_category,
                ovr.organization_email,
                ovr.phone as organization_phone,
                ovr.website as organization_website,
                ovr.status as verification_status,
                ovr.rejection_reason,
                org.id as organization_id,
                org.name as registered_org_name,
                org.type as organization_type,
                (SELECT COUNT(*) FROM user_followers WHERE following_id = u.id) as followers_count,
                (SELECT COUNT(*) FROM user_followers WHERE follower_id = u.id) as following_count,
                (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND is_moderated = false) as posts_count,
                EXISTS(SELECT 1 FROM user_followers WHERE follower_id = $2 AND following_id = u.id) as is_following
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT id, organization_name, category, organization_email, phone, website, status, rejection_reason
           FROM organization_verification_requests
           WHERE user_id = u.id
           ORDER BY created_at DESC
           LIMIT 1
         ) ovr ON TRUE
         LEFT JOIN organizations org ON org.owner_id = u.id
         WHERE u.id = $1`,
        [id, currentUserId || '00000000-0000-0000-0000-000000000000']
      );
      return res.rows[0] || null;
    } catch (dbErr: any) {
      logger.error('[UserService] PostgreSQL database query failed in getUserById:', dbErr);
      throw dbErr;
    }
  }

  static async updateUser(id: string, data: any) {
    const fullName = data.fullName || data.full_name;
    const avatarUrl = data.avatarUrl || data.avatar_url;
    const disabilityType = data.disabilityType || data.disability_type;

    const userFields: string[] = [];
    const userValues: any[] = [id];
    let uIdx = 2;

    if (fullName !== undefined) {
      userFields.push(`full_name = $${uIdx++}`);
      userValues.push(fullName);
    }
    if (data.phone !== undefined) {
      userFields.push(`phone = $${uIdx++}`);
      userValues.push(data.phone);
    }
    if (avatarUrl !== undefined) {
      userFields.push(`avatar_url = $${uIdx++}`);
      userValues.push(avatarUrl);
    }

    if (userFields.length > 0) {
      userFields.push(`updated_at = NOW()`);
      await query(
        `UPDATE users SET ${userFields.join(', ')} WHERE id = $1`,
        userValues
      );
    }

    // Update user_profiles
    const profileFields: string[] = [];
    const profileValues: any[] = [id];
    let pIdx = 2;

    if (data.bio !== undefined) {
      profileFields.push(`bio = $${pIdx++}`);
      profileValues.push(data.bio);
    }
    if (data.district !== undefined) {
      profileFields.push(`district = $${pIdx++}`);
      profileValues.push(data.district);
    }
    if (data.state !== undefined) {
      profileFields.push(`state = $${pIdx++}`);
      profileValues.push(data.state);
    }
    if (data.skills !== undefined) {
      profileFields.push(`skills = $${pIdx++}`);
      profileValues.push(data.skills);
    }
    if (disabilityType !== undefined) {
      profileFields.push(`disability_type = $${pIdx++}`);
      profileValues.push(disabilityType);
    }

    if (profileFields.length > 0) {
      await query(
        `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [id]
      );
      await query(
        `UPDATE user_profiles SET ${profileFields.join(', ')} WHERE user_id = $1`,
        profileValues
      );
    }

    return this.getUserById(id, id);
  }

  static async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('You cannot follow yourself');
    }

    await query(
      `INSERT INTO user_followers (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );

    // Notify the target user
    const actorRes = await query(`SELECT full_name FROM users WHERE id = $1`, [followerId]);
    const actorName = actorRes.rows[0]?.full_name || 'Someone';

    NotificationService.createNotification(
      followingId,
      followerId,
      'follow',
      'New Follower',
      `${actorName} started following you.`,
      { followerId }
    ).catch(() => {});

    return { following: true };
  }

  static async unfollowUser(followerId: string, followingId: string) {
    await query(
      `DELETE FROM user_followers WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );
    return { following: false };
  }

  static async getFollowers(userId: string, params: any) {
    const { page, limit, offset } = getPagination(params);

    const countRes = await query(
      `SELECT COUNT(*) FROM user_followers WHERE following_id = $1`,
      [userId]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, f.created_at as followed_at
       FROM user_followers f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return buildPaginatedResult(res.rows, total, page, limit);
  }

  static async getFollowing(userId: string, params: any) {
    const { page, limit, offset } = getPagination(params);

    const countRes = await query(
      `SELECT COUNT(*) FROM user_followers WHERE follower_id = $1`,
      [userId]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, f.created_at as followed_at
       FROM user_followers f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return buildPaginatedResult(res.rows, total, page, limit);
  }

  static async listUserDevices(userId: string) {
    const res = await query(
      `SELECT id, device_name, device_type, os, browser, ip_address, last_active_at, created_at
       FROM user_devices WHERE user_id = $1 ORDER BY last_active_at DESC`,
      [userId]
    );
    return res.rows;
  }

  static async removeUserDevice(userId: string, deviceId: string) {
    await query(`DELETE FROM user_devices WHERE user_id = $1 AND id = $2`, [userId, deviceId]);
    return { success: true };
  }

  static async getMyOrganization(userId: string) {
    try {
      const res = await query(
        `SELECT o.*,
                (SELECT COUNT(*) FROM events e WHERE e.org_id = o.id) AS total_events,
                (SELECT COUNT(*) FROM jobs j WHERE j.org_id = o.id) AS total_jobs,
                (SELECT COUNT(*) FROM schemes s WHERE s.org_id = o.id) AS total_schemes
         FROM organizations o
         WHERE o.owner_id = $1 OR o.id IN (SELECT org_id FROM org_team_members WHERE user_id = $1)
         LIMIT 1`,
        [userId]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
      return null;
    } catch (err: any) {
      if (config.env === 'development') {
        logger.warn('[UserService] DB unreachable, returning fallback mock org for dev');
        return {
          id: '00000000-0000-0000-0000-000000000001',
          owner_id: userId,
          name: 'KnotNex Accessible Foundation',
          slug: 'knotnex-accessible-foundation',
          type: 'NGO',
          about: 'Dedicated to empowering specially-abled individuals with accessible opportunities.',
          mission: 'Equal opportunities for all.',
          vision: 'An inclusive barrier-free world.',
          services: ['Assistive Tech Training', 'Community Engagement', 'Career Placement'],
          is_verified: true,
          followers_count: 1420,
          contact_email: 'contact@knotnex.org',
          contact_phone: '+91 98401 12345',
          website: 'https://knotnex.org',
          total_events: 5,
          total_jobs: 3,
          total_schemes: 2,
        };
      }
      throw err;
    }
  }
}
