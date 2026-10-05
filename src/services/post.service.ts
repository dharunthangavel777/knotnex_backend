import { query } from '../config/database';
import { getPagination, buildPaginatedResult } from '../utils/pagination.util';
import { PostType } from '../types/enums';
import { NotificationService } from './notification.service';

// ────────────────────────────────────────────────────────────────────────────
// Helper: build full post SELECT fragment (shared across feed / getById)
// ────────────────────────────────────────────────────────────────────────────
const POST_SELECT = (userId: string) => `
  SELECT
    p.*,
    u.full_name        AS author_name,
    u.avatar_url       AS author_avatar,
    u.role             AS author_role,
    u.is_verified      AS author_verified,
    u.role             AS author_headline,

    -- real-time counts from DB (source of truth)
    (SELECT COUNT(*)::int FROM post_reactions   pr WHERE pr.post_id = p.id)                AS likes_count,
    (SELECT COUNT(*)::int FROM post_comments    pc WHERE pc.post_id = p.id)                AS comments_count,
    (SELECT COUNT(*)::int FROM post_shares      ps WHERE ps.post_id = p.id)                AS shares_count,
    (SELECT COUNT(*)::int FROM saved_items      si WHERE si.item_id = p.id AND si.item_type='post') AS save_count,
    (SELECT COUNT(*)::int FROM post_views       pv WHERE pv.post_id = p.id)               AS views_count,

    -- per-user state
    EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = '${userId}')         AS is_liked,
    EXISTS(SELECT 1 FROM saved_items   si WHERE si.item_id = p.id AND si.user_id = '${userId}' AND si.item_type='post') AS is_saved,
    EXISTS(SELECT 1 FROM user_followers uf WHERE uf.following_id = p.author_id AND uf.follower_id = '${userId}') AS is_following_author,

    -- top 3 likers for "liked by" preview
    (SELECT json_agg(liker_info) FROM (
      SELECT u2.id, u2.full_name, u2.avatar_url
      FROM post_reactions pr2
      JOIN users u2 ON u2.id = pr2.user_id
      WHERE pr2.post_id = p.id
      ORDER BY pr2.created_at DESC
      LIMIT 3
    ) liker_info) AS liked_by_preview

  FROM posts p
  JOIN users u ON p.author_id = u.id
`;

const FALLBACK_UUID = '00000000-0000-0000-0000-000000000000';

export class PostService {
  // ────────────────────────────────────────────────────────────────
  // CREATE POST
  // ────────────────────────────────────────────────────────────────
  static async createPost(authorId: string, data: any) {
    const mediaUrls     = data.mediaUrls   || data.media_urls   || [];
    const postType      = data.postType    || data.post_type    || PostType.POST;
    const thumbnailUrl  = data.thumbnailUrl|| data.thumbnail_url|| null;
    const taggedUsers   = data.taggedUsers || data.tagged_users || [];

    const res = await query(
      `INSERT INTO posts (
         author_id, caption, media_urls, post_type, thumbnail_url, tags,
         location, audience, category, community, tagged_users,
         allow_comments, allow_reposts
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        authorId,
        data.caption    || data.content || null,
        mediaUrls,
        postType,
        thumbnailUrl,
        data.tags       || [],
        data.location   || null,
        data.audience   || 'public',
        data.category   || null,
        data.community  || null,
        taggedUsers,
        data.allowComments  !== false,
        data.allowReposts   !== false,
      ]
    );

    return res.rows[0];
  }

  // ────────────────────────────────────────────────────────────────
  // GET FEED (personalized — follows + public)
  // ────────────────────────────────────────────────────────────────
  static async getFeed(userId: string, params: any) {
    const { page, limit, offset } = getPagination(params);
    const safeId = userId || FALLBACK_UUID;

    const countRes = await query(
      `SELECT COUNT(*) FROM posts WHERE is_moderated = false AND audience = 'public'`
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const postsRes = await query(
      `${POST_SELECT(safeId)}
       WHERE p.is_moderated = false
         AND p.audience = 'public'
       ORDER BY
         -- Boost posts from followed authors
         (CASE WHEN EXISTS(
           SELECT 1 FROM user_followers uf
           WHERE uf.following_id = p.author_id AND uf.follower_id = '${safeId}'
         ) THEN 1 ELSE 0 END) DESC,
         -- Then recency
         p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return buildPaginatedResult(postsRes.rows, total, page, limit);
  }

  // ────────────────────────────────────────────────────────────────
  // GET REELS
  // ────────────────────────────────────────────────────────────────
  static async getReels(userId: string, params: any) {
    const { page, limit, offset } = getPagination(params);
    const safeId = userId || FALLBACK_UUID;

    const countRes = await query(
      `SELECT COUNT(*) FROM posts WHERE post_type = 'reel' AND is_moderated = false`
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const reelsRes = await query(
      `${POST_SELECT(safeId)}
       WHERE p.post_type = 'reel' AND p.is_moderated = false
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return buildPaginatedResult(reelsRes.rows, total, page, limit);
  }

  // ────────────────────────────────────────────────────────────────
  // GET SINGLE POST
  // ────────────────────────────────────────────────────────────────
  static async getPostById(postId: string, userId?: string) {
    const safeId = userId || FALLBACK_UUID;
    const res = await query(
      `${POST_SELECT(safeId)} WHERE p.id = $1`,
      [postId]
    );
    return res.rows[0] || null;
  }

  // ────────────────────────────────────────────────────────────────
  // DELETE POST
  // ────────────────────────────────────────────────────────────────
  static async deletePost(postId: string, userId: string, isAdmin: boolean = false) {
    if (isAdmin) {
      await query(`DELETE FROM posts WHERE id = $1`, [postId]);
    } else {
      const res = await query(
        `DELETE FROM posts WHERE id = $1 AND author_id = $2`,
        [postId, userId]
      );
      if (res.rowCount === 0) {
        throw new Error('Unauthorized to delete this post or post not found');
      }
    }
    return { deleted: true };
  }

  // ────────────────────────────────────────────────────────────────
  // TOGGLE LIKE
  // ────────────────────────────────────────────────────────────────
  static async toggleLike(postId: string, userId: string) {
    const check = await query(
      `SELECT id FROM post_reactions WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );

    if ((check.rowCount ?? 0) > 0) {
      await query(`DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
      // Keep denormalised counter in sync
      await query(`UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1`, [postId]);
      const countRes = await query(`SELECT COUNT(*)::int AS c FROM post_reactions WHERE post_id=$1`,[postId]);
      return { liked: false, likes_count: countRes.rows[0].c };
    } else {
      await query(
        `INSERT INTO post_reactions (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [postId, userId]
      );
      await query(`UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1`, [postId]);

      // Notify post author
      const postRes  = await query(`SELECT author_id FROM posts WHERE id = $1`, [postId]);
      const authorId = postRes.rows[0]?.author_id;
      if (authorId && authorId !== userId) {
        const actorRes  = await query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
        const actorName = actorRes.rows[0]?.full_name || 'Someone';
        NotificationService.createNotification(
          authorId, userId, 'like',
          'New Like', `${actorName} liked your post.`,
          { postId }
        ).catch(() => {});
      }

      const countRes = await query(`SELECT COUNT(*)::int AS c FROM post_reactions WHERE post_id=$1`,[postId]);
      return { liked: true, likes_count: countRes.rows[0].c };
    }
  }

  // ────────────────────────────────────────────────────────────────
  // GET LIKED-BY USERS (paginated)
  // ────────────────────────────────────────────────────────────────
  static async getLikedBy(postId: string, params: any) {
    const { page, limit, offset } = getPagination(params);

    const countRes = await query(
      `SELECT COUNT(*)::int FROM post_reactions WHERE post_id = $1`, [postId]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await query(
      `SELECT u.id, u.full_name, u.avatar_url, u.role as headline, u.is_verified, pr.created_at as liked_at
       FROM post_reactions pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.post_id = $1
       ORDER BY pr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [postId, limit, offset]
    );

    return buildPaginatedResult(res.rows, total, page, limit);
  }

  // ────────────────────────────────────────────────────────────────
  // TOGGLE SAVE / UNSAVE
  // ────────────────────────────────────────────────────────────────
  static async toggleSave(userId: string, postId: string) {
    const check = await query(
      `SELECT id FROM saved_items WHERE user_id=$1 AND item_id=$2 AND item_type='post'`,
      [userId, postId]
    );

    if ((check.rowCount ?? 0) > 0) {
      await query(
        `DELETE FROM saved_items WHERE user_id=$1 AND item_id=$2 AND item_type='post'`,
        [userId, postId]
      );
      await query(`UPDATE posts SET save_count = GREATEST(0, save_count - 1) WHERE id=$1`, [postId]);
      const countRes = await query(`SELECT COUNT(*)::int AS c FROM saved_items WHERE item_id=$1 AND item_type='post'`,[postId]);
      return { saved: false, save_count: countRes.rows[0].c };
    } else {
      await query(
        `INSERT INTO saved_items (user_id, item_id, item_type) VALUES ($1,$2,'post') ON CONFLICT DO NOTHING`,
        [userId, postId]
      );
      await query(`UPDATE posts SET save_count = save_count + 1 WHERE id=$1`, [postId]);
      const countRes = await query(`SELECT COUNT(*)::int AS c FROM saved_items WHERE item_id=$1 AND item_type='post'`,[postId]);
      return { saved: true, save_count: countRes.rows[0].c };
    }
  }

  // ────────────────────────────────────────────────────────────────
  // SHARE POST (log + increment)
  // ────────────────────────────────────────────────────────────────
  static async sharePost(postId: string, userId: string, platform: string = 'internal') {
    await query(
      `INSERT INTO post_shares (post_id, user_id, platform) VALUES ($1,$2,$3)`,
      [postId, userId, platform]
    );
    await query(`UPDATE posts SET shares_count = shares_count + 1 WHERE id=$1`, [postId]);

    const countRes = await query(
      `SELECT COUNT(*)::int AS c FROM post_shares WHERE post_id=$1`, [postId]
    );
    return { shared: true, shares_count: countRes.rows[0].c };
  }

  // ────────────────────────────────────────────────────────────────
  // RECORD VIEW (deduplicated per user per day)
  // ────────────────────────────────────────────────────────────────
  static async recordView(postId: string, userId: string) {
    const res = await query(
      `INSERT INTO post_views (post_id, user_id, viewed_at)
       VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT (post_id, user_id, viewed_at) DO NOTHING
       RETURNING id`,
      [postId, userId]
    );

    // Only increment if this is a new view today
    if ((res.rowCount ?? 0) > 0) {
      await query(`UPDATE posts SET views_count = views_count + 1 WHERE id=$1`, [postId]);
    }

    const countRes = await query(
      `SELECT COUNT(*)::int AS c FROM post_views WHERE post_id=$1`, [postId]
    );
    return { views_count: countRes.rows[0].c };
  }

  // ────────────────────────────────────────────────────────────────
  // REPORT POST
  // ────────────────────────────────────────────────────────────────
  static async reportPost(postId: string, userId: string, reason: string, details?: string) {
    await query(
      `INSERT INTO post_reports (post_id, reporter_id, reason, details)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (post_id, reporter_id) DO UPDATE SET reason=$3, details=$4`,
      [postId, userId, reason, details || null]
    );
    await query(`UPDATE posts SET flagged_for_review = true WHERE id=$1`, [postId]);
    return { reported: true };
  }

  // ────────────────────────────────────────────────────────────────
  // GET COMMENTS (threaded, with like counts & user's like state)
  // ────────────────────────────────────────────────────────────────
  static async getComments(postId: string, userId?: string) {
    const safeId = userId || FALLBACK_UUID;

    const res = await query(
      `SELECT
         c.*,
         u.full_name   AS author_name,
         u.avatar_url  AS author_avatar,
         u.is_verified AS author_verified,
         (SELECT COUNT(*)::int FROM comment_reactions cr WHERE cr.comment_id = c.id) AS likes_count,
         EXISTS(
           SELECT 1 FROM comment_reactions cr
           WHERE cr.comment_id = c.id AND cr.user_id = $2
         ) AS is_liked
       FROM post_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId, safeId]
    );

    // Build threaded tree
    const map: Record<string, any> = {};
    const roots: any[] = [];

    for (const row of res.rows) {
      map[row.id] = { ...row, replies: [] };
    }
    for (const row of res.rows) {
      if (row.parent_id && map[row.parent_id]) {
        map[row.parent_id].replies.push(map[row.id]);
      } else {
        roots.push(map[row.id]);
      }
    }

    return roots;
  }

  // ────────────────────────────────────────────────────────────────
  // ADD COMMENT (supports replies via parentId)
  // ────────────────────────────────────────────────────────────────
  static async addComment(postId: string, authorId: string, content: string, parentId?: string) {
    const res = await query(
      `INSERT INTO post_comments (post_id, author_id, content, parent_id)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [postId, authorId, content, parentId || null]
    );

    await query(`UPDATE posts SET comments_count = comments_count + 1 WHERE id=$1`, [postId]);

    // Notify post author
    const postRes      = await query(`SELECT author_id FROM posts WHERE id=$1`, [postId]);
    const postAuthorId = postRes.rows[0]?.author_id;
    if (postAuthorId && postAuthorId !== authorId) {
      const actorRes  = await query(`SELECT full_name FROM users WHERE id=$1`, [authorId]);
      const actorName = actorRes.rows[0]?.full_name || 'Someone';
      const snippet   = content.length > 50 ? `${content.substring(0, 47)}...` : content;
      NotificationService.createNotification(
        postAuthorId, authorId, 'comment',
        'New Comment', `${actorName} commented: "${snippet}"`,
        { postId, commentId: res.rows[0].id }
      ).catch(() => {});
    }

    // If it's a reply, notify the parent commenter too
    if (parentId) {
      const parentRes    = await query(`SELECT author_id FROM post_comments WHERE id=$1`, [parentId]);
      const parentAuthor = parentRes.rows[0]?.author_id;
      if (parentAuthor && parentAuthor !== authorId && parentAuthor !== postAuthorId) {
        const actorRes  = await query(`SELECT full_name FROM users WHERE id=$1`, [authorId]);
        const actorName = actorRes.rows[0]?.full_name || 'Someone';
        NotificationService.createNotification(
          parentAuthor, authorId, 'reply',
          'New Reply', `${actorName} replied to your comment.`,
          { postId, commentId: res.rows[0].id, parentId }
        ).catch(() => {});
      }
    }

    // Return comment enriched with author info
    const enriched = await query(
      `SELECT c.*, u.full_name AS author_name, u.avatar_url AS author_avatar, u.is_verified AS author_verified,
              0 AS likes_count, false AS is_liked
       FROM post_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.id = $1`,
      [res.rows[0].id]
    );

    return { ...enriched.rows[0], replies: [] };
  }

  // ────────────────────────────────────────────────────────────────
  // TOGGLE COMMENT LIKE
  // ────────────────────────────────────────────────────────────────
  static async toggleCommentLike(commentId: string, userId: string) {
    const check = await query(
      `SELECT id FROM comment_reactions WHERE comment_id=$1 AND user_id=$2`,
      [commentId, userId]
    );

    if ((check.rowCount ?? 0) > 0) {
      await query(`DELETE FROM comment_reactions WHERE comment_id=$1 AND user_id=$2`, [commentId, userId]);
      await query(`UPDATE post_comments SET likes_count = GREATEST(0, likes_count-1) WHERE id=$1`, [commentId]);
      const c = await query(`SELECT COUNT(*)::int AS cnt FROM comment_reactions WHERE comment_id=$1`,[commentId]);
      return { liked: false, likes_count: c.rows[0].cnt };
    } else {
      await query(
        `INSERT INTO comment_reactions (comment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [commentId, userId]
      );
      await query(`UPDATE post_comments SET likes_count = likes_count + 1 WHERE id=$1`, [commentId]);
      const c = await query(`SELECT COUNT(*)::int AS cnt FROM comment_reactions WHERE comment_id=$1`,[commentId]);
      return { liked: true, likes_count: c.rows[0].cnt };
    }
  }

  // ────────────────────────────────────────────────────────────────
  // GET SAVED POSTS FOR A USER
  // ────────────────────────────────────────────────────────────────
  static async getSavedPosts(userId: string, params: any) {
    const { page, limit, offset } = getPagination(params);

    const countRes = await query(
      `SELECT COUNT(*) FROM saved_items WHERE user_id=$1 AND item_type='post'`,
      [userId]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await query(
      `${POST_SELECT(userId)}
       INNER JOIN saved_items si2 ON si2.item_id = p.id AND si2.user_id = $1 AND si2.item_type = 'post'
       WHERE p.is_moderated = false
       ORDER BY si2.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return buildPaginatedResult(res.rows, total, page, limit);
  }

  // ────────────────────────────────────────────────────────────────
  // GET USER'S OWN POSTS
  // ────────────────────────────────────────────────────────────────
  static async getUserPosts(profileUserId: string, viewerId: string, params: any) {
    const { page, limit, offset } = getPagination(params);
    const safeViewer = viewerId || FALLBACK_UUID;

    const countRes = await query(
      `SELECT COUNT(*) FROM posts WHERE author_id=$1 AND is_moderated=false`,
      [profileUserId]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await query(
      `${POST_SELECT(safeViewer)}
       WHERE p.author_id=$1 AND p.is_moderated=false
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [profileUserId, limit, offset]
    );

    return buildPaginatedResult(res.rows, total, page, limit);
  }
}
