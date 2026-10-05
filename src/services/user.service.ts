import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { UserRole } from '../types/enums';
import { NotificationService } from './notification.service';

export class UserService {
  static async listUsers(params: { page?: any; limit?: any; role?: string; search?: string }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.role) {
      conditions.push(`role = $${idx++}`);
      values.push(params.role);
    }

    if (params.search) {
      conditions.push(`(full_name ILIKE $${idx} OR email ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM users ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const usersRes = await query(
      `SELECT id, firebase_uid, email, phone, full_name, avatar_url, role, is_verified, is_banned, created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return buildPaginatedResult(usersRes.rows, total, page, limit);
  }

  static async getUserById(id: string, currentUserId?: string) {
    const res = await query(
      `SELECT u.id, u.firebase_uid, u.email, u.phone, u.full_name, u.avatar_url, u.role, u.is_verified, u.is_banned, u.created_at,
              p.bio, p.district, p.state, p.skills, p.languages, p.disability_type,
              (SELECT COUNT(*) FROM user_followers WHERE following_id = u.id) as followers_count,
              (SELECT COUNT(*) FROM user_followers WHERE follower_id = u.id) as following_count,
              (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND is_moderated = false) as posts_count,
              EXISTS(SELECT 1 FROM user_followers WHERE follower_id = $2 AND following_id = u.id) as is_following
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [id, currentUserId || '00000000-0000-0000-0000-000000000000']
    );
    return res.rows[0] || null;
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
