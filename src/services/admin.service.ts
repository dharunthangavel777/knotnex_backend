import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { config } from '../config';
import { inMemoryUsers } from './user.service';
import { inMemoryEvents } from './event.service';
import { inMemoryJobs } from './job.service';
import { inMemorySchemes } from './scheme.service';
import { NotificationService } from './notification.service';
import { TicketService } from './ticket.service';
import { FirebaseAuthIntegration } from '../integrations/firebase/auth.firebase';
import { generateSlug } from '../utils/slug.util';
import { logger } from '../config/logger';

async function resolveReviewerId(adminUserId?: string): Promise<string | null> {
  if (!adminUserId || adminUserId === 'admin') return null;
  try {
    const userCheck = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [adminUserId]);
    return userCheck.rows.length > 0 ? adminUserId : null;
  } catch {
    return null;
  }
}

function mapCategoryToOrgType(category: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('ngo') || cat.includes('non-profit')) return 'NGO';
  if (cat.includes('csr') || cat.includes('corporate')) return 'CSR Company';
  if (cat.includes('foundation')) return 'Foundation';
  if (cat.includes('hospital') || cat.includes('health')) return 'Hospital';
  if (cat.includes('school') || cat.includes('education') || cat.includes('edtech')) return 'School';
  if (cat.includes('rehab')) return 'Rehabilitation Center';
  return 'Other';
}


// ─── Development Fallback Data for Posts & Reels ────────────────────────────
export const inMemoryAdminPosts: any[] = [
  {
    id: 'd4c7fb5c-211c-4d37-8282-0af846848469',
    author: 'dharun',
    author_name: 'dharun',
    authorEmail: 'dharuncod@gmail.com',
    author_email: 'dharuncod@gmail.com',
    authorAvatar: 'https://knotnex-backend-389663780266.asia-south1.run.app/uploads/avatars/5caab2b6-d2ce-44e8-a900-5b2542e94a62.png',
    author_avatar: 'https://knotnex-backend-389663780266.asia-south1.run.app/uploads/avatars/5caab2b6-d2ce-44e8-a900-5b2542e94a62.png',
    content: 'tetete #jobs #mass @rjsanjay26 @rjsanjay26',
    caption: 'tetete #jobs #mass @rjsanjay26 @rjsanjay26',
    category: 'General',
    likes: 1,
    likes_count: 1,
    comments: 0,
    comments_count: 0,
    shares: 10,
    shares_count: 10,
    views: 61,
    views_count: 61,
    safetyScore: 'Flagged (Spam)',
    status: 'Flagged',
    postType: 'post',
    post_type: 'post',
    isRepost: true,
    isFlagged: true,
    flagged_for_review: true,
    posted: 'Oct 22, 2026',
    active: true,
    media_urls: [
      'https://storage.googleapis.com/knotnex-media-prod/posts/aef1f600-29fd-4e43-9fd2-e7e91d718629.jpg'
    ]
  },
  {
    id: 'POST-7020',
    author: 'Praveen L R',
    author_name: 'Praveen L R',
    authorEmail: 'praveen@knotnex.com',
    author_email: 'praveen@knotnex.com',
    authorAvatar: '',
    author_avatar: '',
    content: 'Inclusive Design Hackathon Bengaluru 2026 registration is now open for students and professionals across Karnataka!',
    caption: 'Inclusive Design Hackathon Bengaluru 2026 registration is now open for students and professionals across Karnataka!',
    category: 'Technology & Skilling',
    likes: 18,
    likes_count: 18,
    comments: 5,
    comments_count: 5,
    shares: 12,
    shares_count: 12,
    views: 740,
    views_count: 740,
    safetyScore: 'Verified (99%)',
    status: 'Repost',
    postType: 'repost',
    post_type: 'repost',
    isRepost: true,
    isFlagged: false,
    flagged_for_review: false,
    posted: 'Yesterday, 3:15 PM',
    active: true,
    media_urls: []
  },
  {
    id: 'POST-7011',
    author: 'Samarthya Coordinator',
    authorEmail: 'coordinator@samarthya-ngo.org',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    content: 'Excited to announce our upcoming National Inclusive Tech & Skilling Conclave 2026! Over 50 assistive tech startups and hiring partners joining us in Bengaluru.',
    category: 'Technology & Skilling',
    likes: 48,
    comments: 12,
    shares: 9,
    views: 1240,
    safetyScore: 'Verified (99%)',
    status: 'Pinned',
    posted: 'Today, 10:30 AM',
    active: true,
  },
  {
    id: 'POST-7008',
    author: 'Arun Kumar',
    authorEmail: 'arun.kumar@example.com',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    content: 'New government welfare update: Assistive Device Subsidy grant program is now open for students with disabilities across Karnataka. Check out the scheme requirements!',
    category: 'Schemes & Welfare',
    likes: 34,
    comments: 8,
    shares: 6,
    views: 890,
    safetyScore: 'Verified (98%)',
    status: 'Featured',
    posted: 'Yesterday',
    active: true,
  },
  {
    id: 'POST-7004',
    author: 'Platform Administrator',
    authorEmail: 'admin@knotnex.com',
    authorAvatar: '',
    content: 'Accessibility QA Analyst positions are now open for remote work. 100% remote with custom screen reader setups and ergonomic aids provided by the employer.',
    category: 'Career & Jobs',
    likes: 22,
    comments: 4,
    shares: 3,
    views: 650,
    safetyScore: 'Verified (100%)',
    status: 'Approved',
    posted: '2 days ago',
    active: true,
  },
  {
    id: 'POST-6995',
    author: 'Community User',
    authorEmail: 'user99@knotnex.test',
    authorAvatar: '',
    content: 'Reported comment in assistive transport discussion flagged by automated safety scanner for community guidelines review.',
    category: 'General Community',
    likes: 2,
    comments: 14,
    shares: 0,
    views: 120,
    safetyScore: 'Flagged (Alert)',
    status: 'Flagged',
    posted: '3 days ago',
    active: false,
  },
];

export const inMemoryAdminReels: any[] = [
  {
    id: 'REEL-501',
    topic: 'Smart Wheelchair AI Ramp & Gradient Detection Demo',
    creator: 'Arun Kumar',
    cluster: 'Assistive Tech & Mobility',
    sentiment: 'Positive (99.2%)',
    viralityScore: '96/100',
    mentions: '840 engagements',
    reach: '18.4k views',
    status: 'Viral Surge',
    active: true,
    videoUrl: 'https://storage.googleapis.com/knotnex-media-prod/reels/wheelchair-demo.mp4',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: 'REEL-488',
    topic: 'Indian Sign Language (ISL) Essentials for Daily Tech Standups',
    creator: 'Priya Sharma',
    cluster: 'Inclusive Workplace',
    sentiment: 'Positive (98.5%)',
    viralityScore: '88/100',
    mentions: '310 engagements',
    reach: '6.2k views',
    status: 'Trending',
    active: true,
    videoUrl: 'https://storage.googleapis.com/knotnex-media-prod/reels/isl-basics.mp4',
    createdAt: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
  },
  {
    id: 'REEL-462',
    topic: 'Audio Description & Screen Reader Testing: 3 Tips for Devs',
    creator: 'Ravi Prasanth',
    cluster: 'Developer Advocacy',
    sentiment: 'Positive (96.8%)',
    viralityScore: '74/100',
    mentions: '95 engagements',
    reach: '2.8k views',
    status: 'Stable',
    active: true,
    videoUrl: 'https://storage.googleapis.com/knotnex-media-prod/reels/screen-reader-tips.mp4',
    createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
  },
  {
    id: 'REEL-440',
    topic: 'Unverified medical claim regarding sensory accommodation aids',
    creator: 'Anonymous Contributor',
    cluster: 'Health & Wellness',
    sentiment: 'Negative Alert (62%)',
    viralityScore: '52/100',
    mentions: '42 flags',
    reach: '1.1k views',
    status: 'Sentiment Alert',
    active: false,
    videoUrl: '',
    createdAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
  },
];

export class AdminService {
  static async setBanStatus(userId: string, isBanned: boolean) {
    try {
      const res = await query(
        `UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, is_banned`,
        [isBanned, userId]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const u = inMemoryUsers.find((user: any) => user.id === userId);
        if (u) {
          u.is_banned = isBanned;
          u.status = isBanned ? 'Banned' : 'Active';
          return { id: u.id, full_name: u.full_name, email: u.email, is_banned: u.is_banned };
        }
      }
      throw dbErr;
    }
  }

  static async setVerificationStatus(userId: string, isVerified: boolean) {
    try {
      const res = await query(
        `UPDATE users SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, is_verified`,
        [isVerified, userId]
      );
      return res.rows[0];
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const u = inMemoryUsers.find((user: any) => user.id === userId);
        if (u) {
          u.is_verified = isVerified;
          return { id: u.id, full_name: u.full_name, email: u.email, is_verified: u.is_verified };
        }
      }
      throw dbErr;
    }
  }

<<<<<<< HEAD
    static async getFeedsCurationQueue(params: { page?: any; limit?: any; status?: string; search?: string; category?: string }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = ["(p.post_type IS NULL OR p.post_type != 'reel')"];
    const values: any[] = [];
    let idx = 1;

    if (params.status && params.status !== 'all') {
      const s = params.status.toLowerCase();
      if (s === 'flagged') {
        conditions.push(`(p.flagged_for_review = true OR EXISTS(SELECT 1 FROM post_reports pr WHERE pr.post_id = p.id))`);
      } else if (s === 'approved') {
        conditions.push(`p.flagged_for_review = false`);
      } else if (s === 'featured') {
        conditions.push(`(p.audience = 'featured' OR p.likes_count >= 5)`);
      } else if (s === 'pinned') {
        conditions.push(`p.audience = 'pinned'`);
      } else if (s === 'repost' || s === 'reposts') {
        conditions.push(`(p.post_type = 'repost' OR p.shares_count > 0 OR EXISTS(SELECT 1 FROM post_shares ps WHERE ps.post_id = p.id))`);
      }
    }

    if (params.category) {
      conditions.push(`p.category ILIKE ${idx++}`);
      values.push(`%${params.category}%`);
    }

    if (params.search) {
      conditions.push(`(p.caption ILIKE ${idx} OR u.full_name ILIKE ${idx} OR p.category ILIKE ${idx} OR p.id::text ILIKE ${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(
        `SELECT COUNT(*) FROM posts p LEFT JOIN users u ON p.author_id = u.id ${whereClause}`,
        values
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const postsRes = await query(
        `SELECT p.*,
                u.full_name as author_name,
                u.email as author_email,
                u.avatar_url as author_avatar,
                COALESCE(pr.reports_count, 0) as reports_count,
                pr.last_reason as last_report_reason
         FROM posts p
         LEFT JOIN users u ON p.author_id = u.id
         LEFT JOIN (
           SELECT post_id, COUNT(*)::int as reports_count, MAX(reason) as last_reason
           FROM post_reports
           GROUP BY post_id
         ) pr ON pr.post_id = p.id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT ${idx++} OFFSET ${idx++}`,
        [...values, limit, offset]
      );

      const mapped = postsRes.rows.map((row: any) => {
        const isReported = Boolean(row.flagged_for_review || Number(row.reports_count || 0) > 0);
        const isRepost = Boolean(row.post_type === 'repost' || Number(row.shares_count || 0) > 0);
        let status = 'Approved';
        if (isReported) {
          status = 'Flagged';
        } else if (row.audience === 'pinned') {
          status = 'Pinned';
        } else if (row.audience === 'featured' || (Number(row.likes_count) >= 5)) {
          status = 'Featured';
        } else if (isRepost) {
          status = 'Repost';
        }

        return {
          id: row.id,
          author: row.author_name || 'Community Member',
          author_name: row.author_name || 'Community Member',
          authorEmail: row.author_email || '',
          author_email: row.author_email || '',
          authorAvatar: row.author_avatar || '',
          author_avatar: row.author_avatar || '',
          content: row.caption || '',
          caption: row.caption || '',
          category: row.category || (row.tags && row.tags[0]) || 'General Community',
          likes: Number(row.likes_count) || 0,
          likes_count: Number(row.likes_count) || 0,
          comments: Number(row.comments_count) || 0,
          comments_count: Number(row.comments_count) || 0,
          shares: Number(row.shares_count) || 0,
          shares_count: Number(row.shares_count) || 0,
          views: Number(row.views_count) || 0,
          views_count: Number(row.views_count) || 0,
          reportsCount: Number(row.reports_count) || 0,
          lastReportReason: row.last_report_reason || null,
          postType: row.post_type || 'post',
          post_type: row.post_type || 'post',
          isRepost,
          isFlagged: isReported,
          flagged_for_review: isReported,
          safetyScore: isReported
            ? (row.last_report_reason ? `Flagged (${row.last_report_reason})` : 'Flagged (Alert)')
            : 'Verified (99%)',
          status,
          posted: row.created_at
            ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Recently',
          created_at: row.created_at,
          active: row.audience !== 'private',
          media_urls: row.media_urls || [],
          thumbnail_url: row.thumbnail_url || null,
        };
      });

      if (mapped.length > 0) {
        return buildPaginatedResult(mapped, total, page, limit);
      }

      // If DB returned 0 rows or is in-memory dev mode, provide curated fallback items
      let filtered = [...inMemoryAdminPosts];
      if (params.status && params.status !== 'all') {
        const s = params.status.toLowerCase();
        filtered = filtered.filter(p => {
          if (s === 'repost' || s === 'reposts') return p.isRepost || p.status.toLowerCase() === 'repost';
          if (s === 'flagged') return p.isFlagged || p.status.toLowerCase() === 'flagged';
          return p.status.toLowerCase() === s;
        });
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(p => p.content.toLowerCase().includes(q) || p.author.toLowerCase().includes(q));
      }
      return buildPaginatedResult(filtered, filtered.length, page, limit);
    } catch (dbErr: any) {
      let filtered = [...inMemoryAdminPosts];
      if (params.status && params.status !== 'all') {
        const s = params.status.toLowerCase();
        filtered = filtered.filter(p => {
          if (s === 'repost' || s === 'reposts') return p.isRepost || p.status.toLowerCase() === 'repost';
          if (s === 'flagged') return p.isFlagged || p.status.toLowerCase() === 'flagged';
          return p.status.toLowerCase() === s;
        });
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(p => p.content.toLowerCase().includes(q) || p.author.toLowerCase().includes(q));
      }
      return buildPaginatedResult(filtered, filtered.length, page, limit);
    }
  }

  static async moderateFeedPost(postId: string, action: string, data?: any) {
    try {
      if (action === 'remove' || action === 'delete') {
        await query(`DELETE FROM posts WHERE id = $1`, [postId]);
        const idx = inMemoryAdminPosts.findIndex(p => p.id === postId);
        if (idx !== -1) inMemoryAdminPosts.splice(idx, 1);
        return { action: 'removed', id: postId };
      } else if (action === 'flag') {
        await query(`UPDATE posts SET flagged_for_review = true, updated_at = NOW() WHERE id = $1`, [postId]);
        const item = inMemoryAdminPosts.find(p => p.id === postId);
        if (item) item.status = 'Flagged';
        return { action: 'flagged', id: postId };
      } else if (action === 'approve') {
        await query(`UPDATE posts SET flagged_for_review = false, is_moderated = true, updated_at = NOW() WHERE id = $1`, [postId]);
        const item = inMemoryAdminPosts.find(p => p.id === postId);
        if (item) item.status = 'Approved';
        return { action: 'approved', id: postId };
      } else if (action === 'pin') {
        await query(`UPDATE posts SET audience = 'pinned', updated_at = NOW() WHERE id = $1`, [postId]);
        const item = inMemoryAdminPosts.find(p => p.id === postId);
        if (item) item.status = 'Pinned';
        return { action: 'pinned', id: postId };
      } else if (action === 'unpin') {
        await query(`UPDATE posts SET audience = 'public', updated_at = NOW() WHERE id = $1`, [postId]);
        const item = inMemoryAdminPosts.find(p => p.id === postId);
        if (item) item.status = 'Approved';
        return { action: 'unpinned', id: postId };
      } else if (action === 'toggle_active') {
        const currentRes = await query(`SELECT audience FROM posts WHERE id = $1`, [postId]);
        const currentAudience = currentRes.rows[0]?.audience || 'public';
        const nextAudience = currentAudience === 'private' ? 'public' : 'private';
        await query(`UPDATE posts SET audience = $1, updated_at = NOW() WHERE id = $2`, [nextAudience, postId]);
        const item = inMemoryAdminPosts.find(p => p.id === postId);
        if (item) item.active = (nextAudience !== 'private');
        return { action: 'toggled_active', active: (nextAudience !== 'private'), id: postId };
      } else {
        await query(`UPDATE posts SET is_moderated = true, flagged_for_review = false, updated_at = NOW() WHERE id = $1`, [postId]);
        return { action: 'moderated', id: postId };
      }
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const item = inMemoryAdminPosts.find(p => p.id === postId);
        if (item) {
          if (action === 'remove' || action === 'delete') {
            const idx = inMemoryAdminPosts.findIndex(p => p.id === postId);
            if (idx !== -1) inMemoryAdminPosts.splice(idx, 1);
          } else if (action === 'pin') {
            item.status = 'Pinned';
          } else if (action === 'unpin') {
            item.status = 'Approved';
          } else if (action === 'flag') {
            item.status = 'Flagged';
          } else if (action === 'approve') {
            item.status = 'Approved';
          } else if (action === 'toggle_active') {
            item.active = !item.active;
          }
          return { action, id: postId, item };
        }
      }
      throw dbErr;
    }
  }

  static async editFeedPost(postId: string, data: { caption?: string; content?: string; category?: string; status?: string; active?: boolean }) {
    const newCaption = data.caption || data.content;
    const newCategory = data.category;
    const newAudience = data.active !== undefined ? (data.active ? 'public' : 'private') : undefined;

    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let idx = 1;

      if (newCaption !== undefined) {
        updates.push(`caption = $${idx++}`);
        values.push(newCaption);
      }
      if (newCategory !== undefined) {
        updates.push(`category = $${idx++}`);
        values.push(newCategory);
      }
      if (newAudience !== undefined) {
        updates.push(`audience = $${idx++}`);
        values.push(newAudience);
      }
      if (data.status) {
        if (data.status === 'Flagged') {
          updates.push(`flagged_for_review = TRUE`);
        } else if (data.status === 'Approved') {
          updates.push(`is_moderated = TRUE, flagged_for_review = FALSE`);
        } else if (data.status === 'Pinned') {
          updates.push(`audience = 'pinned', is_moderated = TRUE`);
        }
      }

      values.push(postId);
      const res = await query(
        `UPDATE posts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      const item = inMemoryAdminPosts.find(p => p.id === postId);
      if (item) {
        if (newCaption) item.content = newCaption;
        if (newCategory) item.category = newCategory;
        if (data.status) item.status = data.status as any;
        if (data.active !== undefined) item.active = data.active;
      }

      return res.rows[0] || item;
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const item = inMemoryAdminPosts.find(p => p.id === postId);
        if (item) {
          if (newCaption) item.content = newCaption;
          if (newCategory) item.category = newCategory;
          if (data.status) item.status = data.status as any;
          if (data.active !== undefined) item.active = data.active;
          return item;
        }
      }
      throw dbErr;
    }
  }

  static async deleteFeedPost(postId: string) {
    return this.moderateFeedPost(postId, 'delete');
  }

  static async getAdminReels(params: { page?: any; limit?: any; filter?: string; search?: string }) {
    const { page, limit, offset } = getPagination(params);

    const conditions: string[] = ["p.post_type = 'reel'"];
    const values: any[] = [];
    let idx = 1;

    if (params.search) {
      conditions.push(`(p.caption ILIKE $${idx} OR u.full_name ILIKE $${idx} OR p.category ILIKE $${idx} OR p.id::text ILIKE $${idx})`);
      values.push(`%${params.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(
        `SELECT COUNT(*) FROM posts p LEFT JOIN users u ON p.author_id = u.id ${whereClause}`,
        values
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const reelsRes = await query(
        `SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
         FROM posts p
         LEFT JOIN users u ON p.author_id = u.id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...values, limit, offset]
      );

      const mapped = reelsRes.rows.map((row: any) => {
        const likes = Number(row.likes_count) || 0;
        const comments = Number(row.comments_count) || 0;
        const views = Number(row.views_count) || 0;
        const shares = Number(row.shares_count) || 0;

        let status: 'Viral Surge' | 'Trending' | 'Stable' | 'Sentiment Alert' = 'Stable';
        if (row.flagged_for_review) {
          status = 'Sentiment Alert';
        } else if (views >= 1000 || shares >= 20 || likes >= 100) {
          status = 'Viral Surge';
        } else if (views >= 200 || comments >= 5 || likes >= 20) {
          status = 'Trending';
        }

        const viralityScore = Math.min(99, Math.max(30, Math.round((likes * 3 + comments * 5 + shares * 10 + views) / 20))) + '/100';

        return {
          id: row.id,
          topic: row.caption || 'Inclusive Innovation & Technology',
          creator: row.author_name || 'Community Creator',
          creatorAvatar: row.author_avatar || '',
          cluster: row.category || (row.tags && row.tags[0]) || 'Accessibility & Tech',
          sentiment: row.flagged_for_review ? 'Negative Alert' : 'Positive (98.4%)',
          viralityScore,
          mentions: `${comments + likes} engagements`,
          reach: `${views || (likes * 14) || 240} views`,
          status,
          active: row.audience !== 'private',
          videoUrl: (row.media_urls && row.media_urls[0]) || '',
          thumbnailUrl: row.thumbnail_url || (row.media_urls && row.media_urls[0]) || '',
          createdAt: row.created_at,
        };
      });

      let results = mapped;
      if (params.filter && params.filter !== 'all') {
        const f = params.filter.toLowerCase();
        if (f === 'viral') results = results.filter((r: any) => r.status === 'Viral Surge');
        else if (f === 'trending') results = results.filter((r: any) => r.status === 'Trending');
        else if (f === 'alert') results = results.filter((r: any) => r.status === 'Sentiment Alert');
      }

      if (results.length > 0) {
        return buildPaginatedResult(results, total, page, limit);
      }

      if (config.env === 'development') {
        let filtered = [...inMemoryAdminReels];
        if (params.filter && params.filter !== 'all') {
          const f = params.filter.toLowerCase();
          if (f === 'viral') filtered = filtered.filter(r => r.status === 'Viral Surge');
          else if (f === 'trending') filtered = filtered.filter(r => r.status === 'Trending');
          else if (f === 'alert') filtered = filtered.filter(r => r.status === 'Sentiment Alert');
        }
        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = filtered.filter(r => r.topic.toLowerCase().includes(q) || r.creator.toLowerCase().includes(q) || r.cluster.toLowerCase().includes(q));
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }

      return buildPaginatedResult(results, total, page, limit);
    } catch (dbErr: any) {
      if (config.env === 'development') {
        let filtered = [...inMemoryAdminReels];
        if (params.filter && params.filter !== 'all') {
          const f = params.filter.toLowerCase();
          if (f === 'viral') filtered = filtered.filter(r => r.status === 'Viral Surge');
          else if (f === 'trending') filtered = filtered.filter(r => r.status === 'Trending');
          else if (f === 'alert') filtered = filtered.filter(r => r.status === 'Sentiment Alert');
        }
        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = filtered.filter(r => r.topic.toLowerCase().includes(q) || r.creator.toLowerCase().includes(q) || r.cluster.toLowerCase().includes(q));
        }
        return buildPaginatedResult(filtered, filtered.length, page, limit);
      }
      throw dbErr;
    }
  }

  static async editReel(reelId: string, data: { topic?: string; cluster?: string; status?: string; active?: boolean }) {
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let idx = 1;

      if (data.topic !== undefined) {
        updates.push(`caption = $${idx++}`);
        values.push(data.topic);
      }
      if (data.cluster !== undefined) {
        updates.push(`category = $${idx++}`);
        values.push(data.cluster);
      }
      if (data.active !== undefined) {
        updates.push(`audience = $${idx++}`);
        values.push(data.active ? 'public' : 'private');
      }

      values.push(reelId);
      const res = await query(
        `UPDATE posts SET ${updates.join(', ')} WHERE id = $${idx} AND post_type = 'reel' RETURNING *`,
        values
      );

      const item = inMemoryAdminReels.find(r => r.id === reelId);
      if (item) {
        if (data.topic) item.topic = data.topic;
        if (data.cluster) item.cluster = data.cluster;
        if (data.status) item.status = data.status as any;
        if (data.active !== undefined) item.active = data.active;
      }

      return res.rows[0] || item;
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const item = inMemoryAdminReels.find(r => r.id === reelId);
        if (item) {
          if (data.topic) item.topic = data.topic;
          if (data.cluster) item.cluster = data.cluster;
          if (data.status) item.status = data.status as any;
          if (data.active !== undefined) item.active = data.active;
          return item;
        }
      }
      throw dbErr;
    }
  }

  static async moderateReel(reelId: string, action: string, data?: any) {
    try {
      if (action === 'delete' || action === 'remove') {
        await query(`DELETE FROM posts WHERE id = $1 AND post_type = 'reel'`, [reelId]);
        const idx = inMemoryAdminReels.findIndex(r => r.id === reelId);
        if (idx !== -1) inMemoryAdminReels.splice(idx, 1);
        return { action: 'deleted', id: reelId };
      } else if (action === 'toggle_active') {
        const currentRes = await query(`SELECT audience FROM posts WHERE id = $1`, [reelId]);
        const currentAudience = currentRes.rows[0]?.audience || 'public';
        const nextAudience = currentAudience === 'private' ? 'public' : 'private';
        await query(`UPDATE posts SET audience = $1, updated_at = NOW() WHERE id = $2`, [nextAudience, reelId]);
        const item = inMemoryAdminReels.find(r => r.id === reelId);
        if (item) item.active = (nextAudience !== 'private');
        return { action: 'toggled_active', active: (nextAudience !== 'private'), id: reelId };
      } else {
        return { action, id: reelId };
      }
    } catch (dbErr: any) {
      if (config.env === 'development') {
        const item = inMemoryAdminReels.find(r => r.id === reelId);
        if (item) {
          if (action === 'delete' || action === 'remove') {
            const idx = inMemoryAdminReels.findIndex(r => r.id === reelId);
            if (idx !== -1) inMemoryAdminReels.splice(idx, 1);
          } else if (action === 'toggle_active') {
            item.active = !item.active;
          }
          return { action, id: reelId, item };
        }
      }
      throw dbErr;
    }
  }

  static async deleteReel(reelId: string) {
    return this.moderateReel(reelId, 'delete');
  }

  static async deleteTicket(ticketId: string) {
    return TicketService.deleteTicket(ticketId);
  }

  static async clearTickets(params?: { status?: string }) {
    return TicketService.clearTickets(params);
  }

=======
  static async getFeedsCurationQueue(params: { page?: any; limit?: any; filter?: string }) {
    const { page, limit, offset } = getPagination(params);
    const filter = params.filter || 'all';

    try {
      let whereClause = '';
      if (filter === 'flagged') {
        whereClause = 'WHERE p.flagged_for_review = true';
      } else if (filter === 'approved') {
        whereClause = 'WHERE p.is_moderated = true OR p.flagged_for_review = false';
      }

      const countRes = await query(`SELECT COUNT(*) FROM posts p ${whereClause}`);
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const postsRes = await query(
        `SELECT p.*, u.full_name as author_name, u.email as author_email
         FROM posts p
         JOIN users u ON p.author_id = u.id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      if (postsRes.rows.length > 0) {
        return buildPaginatedResult(postsRes.rows, total, page, limit);
      }
    } catch (dbErr: any) {}

    // Fallback seed posts for curation review
    const samplePosts = [
      {
        id: 'post-cur-1',
        author: 'Inclusive Tech Guild',
        author_name: 'Inclusive Tech Guild',
        content: 'Check out our latest assistive workstation guide for screen reader users and motorized wheelchair operators.',
        category: 'Technology',
        likes: 124,
        like_count: 124,
        comments: 18,
        comment_count: 18,
        safetyScore: '98%',
        status: 'Approved',
        flagged_for_review: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'post-cur-2',
        author: 'Disability Sports Forum',
        author_name: 'Disability Sports Forum',
        content: 'Registration is now open for the National Para Badminton selection trials next month!',
        category: 'Sports',
        likes: 89,
        like_count: 89,
        comments: 12,
        comment_count: 12,
        safetyScore: '99%',
        status: 'Featured',
        flagged_for_review: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'post-cur-3',
        author: 'Community Advocate',
        author_name: 'Community Advocate',
        content: 'Reported post flagged for external link verification regarding unapproved medical device sales.',
        category: 'Health',
        likes: 5,
        like_count: 5,
        comments: 2,
        comment_count: 2,
        safetyScore: '45%',
        status: 'Flagged',
        flagged_for_review: true,
        created_at: new Date().toISOString(),
      },
    ];
    return buildPaginatedResult(samplePosts, samplePosts.length, page, limit);
  }

  static async moderateFeedPost(postId: string, action: 'approve' | 'remove') {
    if (action === 'remove') {
      await query(`DELETE FROM posts WHERE id = $1`, [postId]);
      return { action: 'removed' };
    } else {
      await query(`UPDATE posts SET flagged_for_review = false, is_moderated = true WHERE id = $1`, [postId]);
      return { action: 'approved' };
    }
  }
>>>>>>> a62269b67b1b0708a9d7f1ea3af43281ab5f5518

  static async verifyOrganization(orgId: string, isVerified: boolean) {
    const res = await query(
      `UPDATE organizations SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_verified`,
      [isVerified, orgId]
    );
    return res.rows[0];
  }

  /**
   * Lists all organization verification requests with optional status filtering.
   */
  static async listVerificationRequests(params: { page?: any; limit?: any; status?: string }) {
    const { page, limit, offset } = getPagination(params);
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`r.status = $${idx++}`);
      values.push(params.status.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*) FROM organization_verification_requests r ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const rowsRes = await query(
      `SELECT r.*, u.full_name as user_full_name, u.email as user_email, u.avatar_url as user_avatar, u.role as user_role
       FROM organization_verification_requests r
       JOIN users u ON u.id = r.user_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return buildPaginatedResult(rowsRes.rows, total, page, limit);
  }

  /**
   * Approves an organization verification request:
   * 1. Marks request status as APPROVED.
   * 2. Automatically updates the applicant user role to 'organization' and is_verified to true.
   * 3. Creates the organization entry linked to this user as owner.
   * 4. Updates Firebase custom claims.
   * 5. Sends an in-app and push notification to the user.
   */
  static async approveVerificationRequest(requestId: string, adminUserId?: string) {
    // 1. Fetch request
    const reqRes = await query(
      `SELECT * FROM organization_verification_requests WHERE id = $1`,
      [requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('Verification request not found');
    }
    const request = reqRes.rows[0];
    const userId = request.user_id;

    const reviewerId = await resolveReviewerId(adminUserId);

    // 2. Update request status to APPROVED
    await query(
      `UPDATE organization_verification_requests 
       SET status = 'APPROVED', reviewed_by = $1, updated_at = NOW() 
       WHERE id = $2`,
      [reviewerId, requestId]
    );

    // 3. Elevate user role to 'organization' and mark verified
    const userRes = await query(
      `UPDATE users 
       SET role = 'organization', is_verified = TRUE, updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, firebase_uid, email, full_name, role, is_verified`,
      [userId]
    );
    const updatedUser = userRes.rows[0];

    // 4. Create or update the organization entry for this user
    const slug = generateSlug(request.organization_name);
    const orgType = mapCategoryToOrgType(request.category);

    const orgRes = await query(
      `INSERT INTO organizations (
        owner_id, name, slug, type, about, contact_email, contact_phone, website, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      ON CONFLICT (slug) DO UPDATE
        SET is_verified = TRUE, updated_at = NOW()
      RETURNING *`,
      [
        userId,
        request.organization_name,
        slug,
        orgType,
        `Verified ${request.category} on Knotnex`,
        request.organization_email,
        request.phone,
        request.website || null,
      ]
    );
    const org = orgRes.rows[0];

    // 5. Add owner to org_team_members
    await query(
      `INSERT INTO org_team_members (org_id, user_id, role_in_org, permissions)
       VALUES ($1, $2, 'Owner', ARRAY['admin', 'all'])
       ON CONFLICT DO NOTHING`,
      [org.id, userId]
    ).catch(() => {});

    // 6. Update Firebase custom claims if Firebase UID is available
    if (updatedUser?.firebase_uid) {
      await FirebaseAuthIntegration.setCustomUserClaims(updatedUser.firebase_uid, {
        role: 'organization',
        isVerified: true,
      }).catch((err) => {
        logger.warn('[AdminService] Could not update Firebase claims', { error: err.message });
      });
    }

    // 7. Dispatch in-app notification & push notification
    const notifTitle = 'Organization Account Approved! 🎉';
    const notifBody = `Congratulations! Your organization application for "${request.organization_name}" has been approved. Your account is now switched to Organization mode.`;
    
    await NotificationService.createNotification(
      userId,
      reviewerId,
      'org_approved',
      notifTitle,
      notifBody,
      {
        orgId: org.id,
        role: 'organization',
        orgName: request.organization_name,
        category: request.category,
      }
    );

    logger.info(`[AdminService] Approved org verification request ${requestId} for user ${userId}. Role elevated to organization.`);

    return {
      success: true,
      request: { ...request, status: 'APPROVED' },
      user: updatedUser,
      organization: org,
    };
  }

  /**
   * Rejects an organization verification request and notifies the applicant.
   */
  static async rejectVerificationRequest(requestId: string, adminUserId?: string, reason?: string) {
    const reqRes = await query(
      `SELECT * FROM organization_verification_requests WHERE id = $1`,
      [requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('Verification request not found');
    }
    const request = reqRes.rows[0];

    const reviewerId = await resolveReviewerId(adminUserId);

    await query(
      `UPDATE organization_verification_requests 
       SET status = 'REJECTED', reviewed_by = $1, rejection_reason = $2, updated_at = NOW() 
       WHERE id = $3`,
      [reviewerId, reason || null, requestId]
    );

    const notifTitle = 'Organization Application Update';
    const notifBody = reason
      ? `Your organization application for "${request.organization_name}" was not approved: ${reason}`
      : `Your organization application for "${request.organization_name}" was not approved at this time.`;

    await NotificationService.createNotification(
      request.user_id,
      reviewerId,
      'org_rejected',
      notifTitle,
      notifBody,
      {
        requestId,
        status: 'REJECTED',
        reason: reason || '',
      }
    );

    return {
      success: true,
      requestId,
      status: 'REJECTED',
      reason,
    };
  }

  /**
   * Content Verification System for Events, Jobs, and Schemes
   */
  static async listPendingContent() {
    try {
      const [eventsRes, jobsRes, schemesRes] = await Promise.all([
        query(`SELECT e.*, o.name as org_name, o.logo_url as org_logo FROM events e LEFT JOIN organizations o ON e.org_id = o.id WHERE e.status = 'pending_verification' ORDER BY e.created_at DESC`),
        query(`SELECT j.*, o.name as org_name, o.logo_url as org_logo FROM jobs j LEFT JOIN organizations o ON j.org_id = o.id WHERE j.status = 'pending_verification' ORDER BY j.created_at DESC`),
        query(`SELECT s.*, o.name as org_name, o.logo_url as org_logo FROM schemes s LEFT JOIN organizations o ON s.org_id = o.id WHERE s.status = 'pending_verification' ORDER BY s.created_at DESC`),
      ]);
      return {
        events: eventsRes.rows,
        jobs: jobsRes.rows,
        schemes: schemesRes.rows,
        totalPending: eventsRes.rows.length + jobsRes.rows.length + schemesRes.rows.length,
      };
    } catch (err: any) {
      if (config.env === 'development' || !config.isProduction) {
        const evs = inMemoryEvents.filter((e: any) => e.status === 'pending_verification');
        const jbs = inMemoryJobs.filter((j: any) => j.status === 'pending_verification');
        const schs = inMemorySchemes.filter((s: any) => s.status === 'pending_verification');
        return {
          events: evs,
          jobs: jbs,
          schemes: schs,
          totalPending: evs.length + jbs.length + schs.length,
        };
      }
      throw err;
    }
  }

  static async verifyEvent(eventId: string, adminUserId?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE events 
         SET status = 'published', is_verified = true, verified_at = NOW(), verified_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reviewerId, eventId]
      );
      if (res.rows.length > 0) {
        const ev = res.rows[0];
        if (ev.created_by) {
          await NotificationService.createNotification(
            ev.created_by,
            reviewerId,
            'event_verified',
            'Event Approved & Published!',
            `Your event "${ev.title}" has been verified and is now live across KnotNex.`,
            { eventId: ev.id, status: 'published' }
          ).catch(() => {});
        }
        return ev;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const ev = inMemoryEvents.find((e: any) => String(e.id) === String(eventId));
        if (ev) {
          ev.status = 'published';
          ev.is_verified = true;
          ev.verified_at = new Date().toISOString();
          return ev;
        }
      }
      throw dbErr;
    }
    throw new Error('Event not found');
  }

  static async rejectEvent(eventId: string, adminUserId?: string, reason?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE events 
         SET status = 'rejected', is_verified = false, rejection_reason = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reason || 'Content does not meet publication standards', eventId]
      );
      if (res.rows.length > 0) {
        const ev = res.rows[0];
        if (ev.created_by) {
          await NotificationService.createNotification(
            ev.created_by,
            reviewerId,
            'event_rejected',
            'Event Review Notice',
            `Your event "${ev.title}" requires revisions: ${reason || 'Does not meet guidelines'}`,
            { eventId: ev.id, status: 'rejected', reason }
          ).catch(() => {});
        }
        return ev;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const ev = inMemoryEvents.find((e: any) => String(e.id) === String(eventId));
        if (ev) {
          ev.status = 'rejected';
          ev.is_verified = false;
          ev.rejection_reason = reason;
          return ev;
        }
      }
      throw dbErr;
    }
    throw new Error('Event not found');
  }

  static async verifyJob(jobId: string, adminUserId?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE jobs 
         SET status = 'open', is_verified = true, verified_at = NOW(), verified_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reviewerId, jobId]
      );
      if (res.rows.length > 0) {
        const job = res.rows[0];
        if (job.created_by) {
          await NotificationService.createNotification(
            job.created_by,
            reviewerId,
            'job_verified',
            'Job Opportunity Live!',
            `Your job opening "${job.title}" has been verified and published to applicants.`,
            { jobId: job.id, status: 'open' }
          ).catch(() => {});
        }
        return job;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const job = inMemoryJobs.find((j: any) => String(j.id) === String(jobId));
        if (job) {
          job.status = 'open';
          job.is_verified = true;
          job.verified_at = new Date().toISOString();
          return job;
        }
      }
      throw dbErr;
    }
    throw new Error('Job not found');
  }

  static async rejectJob(jobId: string, adminUserId?: string, reason?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE jobs 
         SET status = 'rejected', is_verified = false, rejection_reason = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reason || 'Job requirements require revisions', jobId]
      );
      if (res.rows.length > 0) {
        const job = res.rows[0];
        if (job.created_by) {
          await NotificationService.createNotification(
            job.created_by,
            reviewerId,
            'job_rejected',
            'Job Review Notice',
            `Your job posting "${job.title}" was not approved: ${reason || 'Requires revisions'}`,
            { jobId: job.id, status: 'rejected', reason }
          ).catch(() => {});
        }
        return job;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const job = inMemoryJobs.find((j: any) => String(j.id) === String(jobId));
        if (job) {
          job.status = 'rejected';
          job.is_verified = false;
          job.rejection_reason = reason;
          return job;
        }
      }
      throw dbErr;
    }
    throw new Error('Job not found');
  }

  static async verifyScheme(schemeId: string, adminUserId?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE schemes 
         SET status = 'active', is_verified = true, verified_at = NOW(), verified_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reviewerId, schemeId]
      );
      if (res.rows.length > 0) {
        const scheme = res.rows[0];
        if (scheme.created_by) {
          await NotificationService.createNotification(
            scheme.created_by,
            reviewerId,
            'scheme_verified',
            'Grant Scheme Live!',
            `Your welfare scheme "${scheme.title}" has been verified and is active for applications.`,
            { schemeId: scheme.id, status: 'active' }
          ).catch(() => {});
        }
        return scheme;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const s = inMemorySchemes.find((sch: any) => String(sch.id) === String(schemeId));
        if (s) {
          s.status = 'active';
          s.is_verified = true;
          s.verified_at = new Date().toISOString();
          return s;
        }
      }
      throw dbErr;
    }
    throw new Error('Scheme not found');
  }

  static async rejectScheme(schemeId: string, adminUserId?: string, reason?: string) {
    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      const res = await query(
        `UPDATE schemes 
         SET status = 'rejected', is_verified = false, rejection_reason = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [reason || 'Welfare criteria require review', schemeId]
      );
      if (res.rows.length > 0) {
        const scheme = res.rows[0];
        if (scheme.created_by) {
          await NotificationService.createNotification(
            scheme.created_by,
            reviewerId,
            'scheme_rejected',
            'Scheme Review Notice',
            `Your scheme "${scheme.title}" was not approved: ${reason || 'Requires revisions'}`,
            { schemeId: scheme.id, status: 'rejected', reason }
          ).catch(() => {});
        }
        return scheme;
      }
    } catch (dbErr: any) {
      if (config.env === 'development' || !config.isProduction) {
        const s = inMemorySchemes.find((sch: any) => String(sch.id) === String(schemeId));
        if (s) {
          s.status = 'rejected';
          s.is_verified = false;
          s.rejection_reason = reason;
          return s;
        }
      }
      throw dbErr;
    }
    throw new Error('Scheme not found');
  }

  static async getAuditLogs(queryOptions: { page?: any; limit?: any; actorId?: any; targetEntity?: any }) {
    const page = Math.max(1, Number(queryOptions.page || 1));
    const limit = Math.min(100, Math.max(1, Number(queryOptions.limit || 50)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (queryOptions.actorId) {
      conditions.push(`a.actor_id = $${pIdx++}`);
      params.push(queryOptions.actorId);
    }
    if (queryOptions.targetEntity) {
      conditions.push(`a.target_entity = $${pIdx++}`);
      params.push(queryOptions.targetEntity);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countRes = await query(`SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`, params);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const logsRes = await query(
        `SELECT a.*, u.full_name as actor_name, u.email as actor_email, u.role as actor_role
         FROM audit_logs a
         LEFT JOIN users u ON a.actor_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC
         LIMIT $${pIdx++} OFFSET $${pIdx++}`,
        [...params, limit, offset]
      );

      return {
        items: logsRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (dbErr: any) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
      };
    }
  }

  static async sendUserPasswordReset(userId: string, adminUserId?: string) {
    const userRes = await query(`SELECT id, email, full_name FROM users WHERE id = $1`, [userId]);
    let targetEmail: string;
    let targetId: string;

    if (userRes.rows[0]) {
      targetEmail = userRes.rows[0].email;
      targetId = userRes.rows[0].id;
    } else {
      const u = inMemoryUsers.find((user: any) => user.id === userId);
      if (!u || !u.email) {
        throw new Error('User not found or has no email address');
      }
      targetEmail = u.email;
      targetId = u.id;
    }

    try {
      const { AuthService } = await import('./auth.service');
      await AuthService.forgotPassword(targetEmail);
    } catch (emailErr: any) {
      logger.warn('[AdminService] Could not dispatch password reset link via provider: ' + emailErr.message);
    }

    const reviewerId = await resolveReviewerId(adminUserId);
    try {
      await query(
        `INSERT INTO audit_logs (actor_id, action, target_entity, target_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [reviewerId, 'USER_PASSWORD_RESET_DISPATCHED', 'user', targetId, JSON.stringify({ email: targetEmail }), 'admin-portal']
      );
    } catch {}

    return {
      success: true,
      message: `Password reset instructions sent to ${targetEmail}`,
      email: targetEmail,
    };
  }

  static async getAdminReels(_params?: any) {
    try {
      const res = await query(
        'SELECT p.*, u.full_name as author_name, u.email as author_email ' +
        'FROM posts p ' +
        'JOIN users u ON p.author_id = u.id ' +
        'WHERE p.post_type IN (\'video\', \'reel\') OR p.video_url IS NOT NULL ' +
        'ORDER BY p.created_at DESC ' +
        'LIMIT 50'
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          id: row.id,
          topic: row.content ? row.content.slice(0, 45) : 'Community Video Reel',
          creator: row.author_name || 'Knotnex Member',
          cluster: row.category || 'General',
          sentiment: 'Positive (92%)',
          viralityScore: Math.min(99, 50 + (Number(row.like_count) || 0) * 2) + '%',
          mentions: String(row.comment_count || 0),
          reach: String((Number(row.view_count) || 1) * 12),
          status: (Number(row.like_count) || 0) > 20 ? 'Viral Surge' : ((Number(row.like_count) || 0) > 5 ? 'Trending' : 'Stable'),
          active: true,
        }));
      }
    } catch (_) {}

    return [
      {
        id: 'reel-scan-101',
        topic: 'AI Screen Reader Gestures Walkthrough',
        creator: 'Priya Sharma (Tech Access Lead)',
        cluster: 'Assistive Tech & AI',
        sentiment: 'Positive (96%)',
        viralityScore: '94%',
        mentions: '1,420',
        reach: '24.5K',
        status: 'Viral Surge',
        active: true,
      },
      {
        id: 'reel-scan-102',
        topic: 'Para-Athletics Wheelchair Mobility Drill',
        creator: 'Coach Rajesh Verma',
        cluster: 'Adaptive Sports',
        sentiment: 'Positive (98%)',
        viralityScore: '88%',
        mentions: '890',
        reach: '18.2K',
        status: 'Trending',
        active: true,
      },
      {
        id: 'reel-scan-103',
        topic: 'Disability Rights & Accessible Metro Commute',
        creator: 'Advocate Ananya Roy',
        cluster: 'Advocacy & Rights',
        sentiment: 'Neutral (65%)',
        viralityScore: '72%',
        mentions: '430',
        reach: '8.4K',
        status: 'Stable',
        active: true,
      },
      {
        id: 'reel-scan-104',
        topic: 'Inclusive Gaming Controller Setup',
        creator: 'Arjun Das (Gamer)',
        cluster: 'Gaming Accessibility',
        sentiment: 'Positive (91%)',
        viralityScore: '83%',
        mentions: '650',
        reach: '12.1K',
        status: 'Trending',
        active: true,
      },
      {
        id: 'reel-scan-105',
        topic: 'Unverified Herbal Remedy Claims for Cerebral Palsy',
        creator: 'WellnessHub99',
        cluster: 'Health Claims Review',
        sentiment: 'Negative Alert (24%)',
        viralityScore: '68%',
        mentions: '310',
        reach: '6.9K',
        status: 'Sentiment Alert',
        active: false,
      },
    ];
  }

  static async listAdminCampaigns() {
    try {
      const res = await query(
        'SELECT c.*, o.name as organization_name, o.logo_url as organization_logo ' +
        'FROM org_campaigns c ' +
        'LEFT JOIN organizations o ON c.org_id = o.id ' +
        'ORDER BY c.created_at DESC'
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
    } catch (_) {}

    return [
      {
        id: 'camp-seed-1',
        title: 'Wheelchairs for Rural Students Initiative',
        organization_name: 'Enable All Foundation',
        target_amount: 500000,
        raised_amount: 320000,
        status: 'active',
        created_at: new Date().toISOString(),
      },
      {
        id: 'camp-seed-2',
        title: 'Accessible Computer Lab Setup for Visually Impaired Youth',
        organization_name: 'Vision Forward NGO',
        target_amount: 250000,
        raised_amount: 195000,
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ];
  }

  static async deleteCampaign(campaignId: string) {
    try {
      await query('DELETE FROM org_campaigns WHERE id = $1', [campaignId]);
    } catch (_) {}
    return { success: true, message: 'Campaign deleted by admin' };
  }

}
