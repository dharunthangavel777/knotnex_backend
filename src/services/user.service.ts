import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { UserRole } from '../types/enums';
import { NotificationService } from './notification.service';
import { config } from '../config';
import { logger } from '../config/logger';

export interface InMemoryUser {
  id: string;
  firebase_uid: string;
  email: string;
  phone: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  is_verified: boolean;
  is_banned: boolean;
  category_selection_completed: boolean;
  created_at: string;
  verification_request_id?: string | null;
  organization_name?: string | null;
  organization_category?: string | null;
  organization_email?: string | null;
  organization_phone?: string | null;
  organization_website?: string | null;
  verification_status?: string | null;
  rejection_reason?: string | null;
  organization_id?: string | null;
  registered_org_name?: string | null;
  organization_type?: string | null;
  status?: string;
}

export const inMemoryUsers: InMemoryUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    firebase_uid: 'admin-firebase-uid',
    email: 'admin@knotnex.com',
    phone: '+919876543210',
    full_name: 'Platform Administrator',
    role: 'admin',
    is_verified: true,
    is_banned: false,
    category_selection_completed: true,
    created_at: new Date().toISOString(),
    status: 'Active',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    firebase_uid: 'org-firebase-uid',
    email: 'coordinator@samarthya-ngo.org',
    phone: '+919876543211',
    full_name: 'Samarthya Foundation Coordinator',
    role: 'organization',
    is_verified: true,
    is_banned: false,
    category_selection_completed: true,
    created_at: new Date().toISOString(),
    organization_id: '20000000-0000-0000-0000-000000000001',
    organization_name: 'Samarthya Disability Empowerment',
    registered_org_name: 'Samarthya Disability Empowerment',
    organization_category: 'NGO',
    organization_type: 'NGO',
    verification_status: 'APPROVED',
    status: 'Active',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    firebase_uid: 'user-firebase-uid',
    email: 'arun.kumar@example.com',
    phone: '+919876543212',
    full_name: 'Arun Kumar',
    role: 'user',
    is_verified: true,
    is_banned: false,
    category_selection_completed: true,
    created_at: new Date().toISOString(),
    status: 'Active',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    firebase_uid: 'org2-firebase-uid',
    email: 'contact@enableindia.org',
    phone: '+919876543213',
    full_name: 'Enable India Foundation',
    role: 'organization',
    is_verified: false,
    is_banned: false,
    category_selection_completed: true,
    created_at: new Date().toISOString(),
    verification_request_id: 'vr-0000-0000-000000000001',
    organization_name: 'Enable India Foundation',
    organization_category: 'NGO',
    organization_email: 'contact@enableindia.org',
    organization_phone: '+919876543213',
    organization_website: 'https://enableindia.org',
    verification_status: 'PENDING',
    status: 'Pending Verification',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    firebase_uid: 'user2-firebase-uid',
    email: 'priya.sharma@example.com',
    phone: '+919876543214',
    full_name: 'Priya Sharma',
    role: 'user',
    is_verified: true,
    is_banned: true,
    category_selection_completed: true,
    created_at: new Date().toISOString(),
    status: 'Banned',
  },
];

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
         LEFT JOIN LATERAL (
           SELECT id, name, type FROM organizations WHERE owner_id = u.id ORDER BY created_at DESC LIMIT 1
         ) org ON TRUE
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      return buildPaginatedResult(usersRes.rows, total, page, limit);
    } catch (dbErr: any) {
      if (config.env === 'development') {
        logger.warn('[UserService] PostgreSQL query timed out or unreachable, serving in-memory dev users');
        let filtered = [...inMemoryUsers];
        if (params.role) {
          filtered = filtered.filter((u) => u.role === params.role);
        }
        if (params.search) {
          const s = params.search.toLowerCase();
          filtered = filtered.filter(
            (u) =>
              u.full_name?.toLowerCase().includes(s) ||
              u.email?.toLowerCase().includes(s) ||
              (u.organization_name && u.organization_name.toLowerCase().includes(s))
          );
        }
        if (params.status) {
          if (params.status === 'pending_verification') {
            filtered = filtered.filter((u) => u.verification_status === 'PENDING');
          } else if (params.status === 'banned') {
            filtered = filtered.filter((u) => u.is_banned);
          } else if (params.status === 'suspended') {
            filtered = filtered.filter((u) => u.is_banned || !u.is_verified);
          } else if (params.status === 'active') {
            filtered = filtered.filter((u) => !u.is_banned && u.is_verified);
          }
        }
        const total = filtered.length;
        const paged = filtered.slice(offset, offset + limit);
        return buildPaginatedResult(paged, total, page, limit);
      }
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
      if (config.env === 'development') {
        const found = inMemoryUsers.find((u) => u.id === id);
        if (found) {
          return {
            ...found,
            bio: 'Accessibility advocate and community leader.',
            district: 'Bengaluru Urban',
            state: 'Karnataka',
            skills: ['Accessibility', 'Advocacy'],
            followers_count: 12,
            following_count: 5,
            posts_count: 3,
            is_following: false,
          };
        }
      }
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
}
