import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { UserRole } from '../types/enums';
import { NotificationService } from './notification.service';
import { config } from '../config';
import { logger } from '../config/logger';

// Canonical user app records representing platform users across general & organization accounts
export const inMemoryUsers: any[] = [
  {
    id: '00000000-0000-0000-0000-000000000003',
    firebase_uid: 'user-firebase-uid-01',
    email: 'arun.kumar@example.com',
    phone: '+91 98800 11223',
    full_name: 'Arun Kumar',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    role: 'user',
    is_verified: true,
    is_banned: false,
    status: 'Active',
    disability_type: 'Locomotor Disability',
    district: 'Chennai',
    state: 'Tamil Nadu',
    location: 'IIT Madras Research Park, Chennai',
    bio: 'Accessibility advocate & digital marketing enthusiast crafting inclusive digital experiences.',
    skills: ['Digital Marketing', 'Data Analysis', 'Accessible Design'],
    education: [{ institution: 'Loyola College', degree: 'Bachelor of Computer Applications', startYear: 2020, endYear: 2023 }],
    followers_count: 628,
    following_count: 542,
    flags_count: 0,
    created_at: '2026-01-15T10:00:00.000Z'
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    firebase_uid: 'user-firebase-uid-02',
    email: 'priya.sharma@example.com',
    phone: '+91 98450 33445',
    full_name: 'Priya Sharma',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    role: 'user',
    is_verified: true,
    is_banned: false,
    status: 'Active',
    disability_type: 'Visual Impairment',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    location: 'Indiranagar, Bengaluru',
    bio: 'Screen-reader tester and assistive tech specialist advocating for accessible web standards.',
    skills: ['Screen Readers', 'NVDA', 'Web Accessibility (WCAG 2.2)'],
    education: [{ institution: 'Christ University', degree: 'B.Sc Computer Science', startYear: 2021, endYear: 2024 }],
    followers_count: 412,
    following_count: 320,
    flags_count: 0,
    created_at: '2026-02-10T12:30:00.000Z'
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    firebase_uid: 'user-firebase-uid-03',
    email: 'rahul.verma@example.com',
    phone: '+91 97110 55667',
    full_name: 'Rahul Verma',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    role: 'user',
    is_verified: false,
    is_banned: false,
    status: 'KYC Review required',
    disability_type: 'Hearing Impairment',
    district: 'New Delhi',
    state: 'Delhi',
    location: 'Connaught Place, New Delhi',
    bio: 'Graphic artist & Indian Sign Language educator empowering deaf youth in creative careers.',
    skills: ['Sign Language', 'Graphic Design', 'Figma', 'Illustration'],
    education: [{ institution: 'Delhi University', degree: 'Bachelor of Fine Arts', startYear: 2019, endYear: 2023 }],
    followers_count: 890,
    following_count: 670,
    flags_count: 1,
    created_at: '2026-03-01T08:15:00.000Z'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    firebase_uid: 'org-firebase-uid-01',
    email: 'coordinator@samarthya-ngo.org',
    phone: '+91 98765 43211',
    full_name: 'Samarthya Disability Empowerment',
    avatar_url: 'https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?w=300&auto=format&fit=crop&q=80',
    role: 'organization',
    is_verified: true,
    is_banned: false,
    status: 'Active',
    organization: 'Samarthya Disability Empowerment',
    organization_name: 'Samarthya Disability Empowerment',
    organizationType: 'NGO',
    organization_type: 'NGO',
    location: 'Bengaluru Urban, Karnataka',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    bio: 'Working towards equitable education, skilling, and opportunities for specially-abled individuals.',
    website: 'https://samarthya-ngo.org',
    followers_count: 5420,
    following_count: 102,
    flags_count: 0,
    created_at: '2026-01-05T09:00:00.000Z'
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    firebase_uid: 'org-firebase-uid-02',
    email: 'info@besinstitutions.com',
    phone: '+38 4877 5674 23',
    full_name: 'BES Institute for Special Children',
    avatar_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=300&auto=format&fit=crop&q=80',
    role: 'organization',
    is_verified: true,
    is_banned: false,
    status: 'Active',
    organization: 'BES Institute for Special Children',
    organization_name: 'BES Institute for Special Children',
    organizationType: 'NGO / Service Provider',
    organization_type: 'NGO / Service Provider',
    location: 'IIT Madras Research Park, Chennai',
    district: 'Chennai',
    state: 'Tamil Nadu',
    bio: 'Pioneering educational institution dedicated to supporting children with diverse learning needs.',
    website: 'https://besinstitutions.org',
    followers_count: 12400,
    following_count: 85,
    flags_count: 0,
    created_at: '2026-01-20T11:20:00.000Z'
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    firebase_uid: 'org-firebase-uid-03',
    email: 'contact@inclusive-career-hub.org',
    phone: '+91 98220 77889',
    full_name: 'Inclusive Career Foundation',
    avatar_url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=300&auto=format&fit=crop&q=80',
    role: 'organization',
    is_verified: false,
    is_banned: false,
    status: 'KYC Review required',
    organization: 'Inclusive Career Foundation',
    organization_name: 'Inclusive Career Foundation',
    organizationType: 'Foundation',
    organization_type: 'Foundation',
    location: 'Bandra Kurla Complex, Mumbai',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    bio: 'Providing accessible job mentorship, career counseling, and placements across India.',
    website: 'https://inclusive-career-hub.org',
    followers_count: 3100,
    following_count: 64,
    flags_count: 0,
    created_at: '2026-02-18T14:45:00.000Z'
  }
];


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

    try {
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
    } catch (dbErr: any) {
      if (config.env === 'development') {
        logger.warn('[UserService] DB unreachable in dev, serving in-memory users');
        let filtered = [...inMemoryUsers];
        if (params.role) {
          filtered = filtered.filter((u) => u.role === params.role);
        }
        if (params.search) {
          const s = params.search.toLowerCase();
          filtered = filtered.filter((u) => u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }
      throw dbErr;
    }
  }

  static async getUserById(id: string, currentUserId?: string) {
    try {
      const res = await query(
        `SELECT u.id, u.firebase_uid, u.email, u.phone, u.full_name, u.avatar_url, u.role, u.is_verified, u.is_banned, u.category_selection_completed, u.created_at,
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
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const u = inMemoryUsers.find((user) => user.id === id);
        return u || null;
      }
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
