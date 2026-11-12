import { query } from '../config/database';

export interface MessageSearchParams {
  queryText: string;
  conversationId?: string;
  attachmentType?: string; // 'image' | 'video' | 'voice' | 'document' | 'link'
  senderId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export class ChatSearchService {
  /**
   * Searches messages across all non-deleted conversations the authenticated user
   * participates in, excluding messages deleted-for-me, cleared history, and
   * deleted-for-everyone tombstones.
   */
  static async searchMessages(userId: string, params: MessageSearchParams) {
    const rawQ = (params.queryText || '').trim();
    const limit = Math.min(Math.max(Number(params.limit) || 30, 1), 100);
    const offset = Math.max(Number(params.offset) || 0, 0);

    const hasTypeFilter = Boolean(params.attachmentType && params.attachmentType !== 'all');
    if (rawQ.length === 0 && !hasTypeFilter && !params.dateFrom && !params.dateTo) {
      return {
        results: [],
        total: 0,
        hasMore: false,
        query: rawQ,
      };
    }

    const conditions: string[] = [
      '(c.participant_one = $1 OR c.participant_two = $1)',
      'NOT ($1 = ANY(COALESCE(c.deleted_by, \'{}\'::uuid[])))',
      'COALESCE(cp.is_deleted, FALSE) = FALSE',
      "COALESCE(c.status, 'ACCEPTED') NOT IN ('REJECTED', 'BLOCKED')",
      'COALESCE(m.deleted_for_everyone, m.is_deleted, FALSE) = FALSE',
      '(cp.cleared_before_at IS NULL OR m.created_at > cp.cleared_before_at)',
      `NOT EXISTS (
         SELECT 1 FROM message_user_visibility muv
         WHERE muv.message_id = m.id AND muv.user_id = $1
       )`,
      `NOT EXISTS (
         SELECT 1 FROM blocked_users b
         WHERE (b.blocker_id = $1 AND b.blocked_id = CASE WHEN c.participant_one = $1 THEN c.participant_two ELSE c.participant_one END)
            OR (b.blocked_id = $1 AND b.blocker_id = CASE WHEN c.participant_one = $1 THEN c.participant_two ELSE c.participant_one END)
       )`,
    ];

    const values: any[] = [userId];
    let idx = 2;

    if (params.conversationId) {
      conditions.push(`m.conversation_id = $${idx++}`);
      values.push(params.conversationId);
    }

    if (params.senderId) {
      conditions.push(`m.sender_id = $${idx++}`);
      values.push(params.senderId);
    }

    if (params.dateFrom) {
      conditions.push(`m.created_at >= $${idx++}::timestamptz`);
      values.push(params.dateFrom);
    }

    if (params.dateTo) {
      conditions.push(`m.created_at <= $${idx++}::timestamptz`);
      values.push(params.dateTo);
    }

    if (params.attachmentType && params.attachmentType !== 'all') {
      const kind = params.attachmentType.toLowerCase();
      if (kind === 'link') {
        conditions.push(`(m.content ~* 'https?://[^\\s]+' OR m.message_type IN ('post', 'reel', 'profile'))`);
      } else if (kind === 'media') {
        conditions.push(
          `(m.message_type IN ('image', 'video', 'media_group') OR EXISTS (
             SELECT 1 FROM message_attachments ma
             WHERE ma.message_id = m.id AND ma.attachment_type IN ('image', 'video')
           ))`
        );
      } else {
        conditions.push(
          `(m.message_type = $${idx} OR EXISTS (
             SELECT 1 FROM message_attachments ma
             WHERE ma.message_id = m.id AND ma.attachment_type = $${idx}
           ))`
        );
        values.push(kind);
        idx++;
      }
    }

    let rankExpr = '0::real';
    if (rawQ.length > 0) {
      const qParam = idx++;
      values.push(rawQ);
      const likeParam = idx++;
      values.push(`%${rawQ}%`);

      conditions.push(
        `(m.search_vector @@ plainto_tsquery('simple', $${qParam})
          OR m.content ILIKE $${likeParam}
          OR COALESCE(m.metadata->>'caption', '') ILIKE $${likeParam}
          OR COALESCE(m.metadata->>'fileName', '') ILIKE $${likeParam}
          OR COALESCE(m.metadata->>'sharedTitle', '') ILIKE $${likeParam})`
      );
      rankExpr = `ts_rank(m.search_vector, plainto_tsquery('simple', $${qParam}))`;
    }

    const limitParam = idx++;
    values.push(limit + 1);
    const offsetParam = idx++;
    values.push(offset);

    const sql = `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.content,
        m.message_type,
        m.media_url,
        m.metadata,
        m.created_at,
        peer.id AS peer_id,
        peer.full_name AS peer_name,
        peer.username AS peer_username,
        peer.avatar_url AS peer_avatar_url,
        peer.is_verified AS peer_is_verified,
        sender.full_name AS sender_name,
        sender.username AS sender_username,
        ${rankExpr} AS rank,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ma.id,
                'attachmentIndex', ma.attachment_index,
                'attachmentType', ma.attachment_type,
                'mediaUrl', ma.media_url,
                'thumbnailUrl', ma.thumbnail_url,
                'originalFilename', ma.original_filename,
                'mimeType', ma.mime_type,
                'fileSizeBytes', ma.file_size_bytes,
                'width', ma.width,
                'height', ma.height,
                'durationMs', ma.duration_ms
              )
              ORDER BY ma.attachment_index ASC
            )
            FROM message_attachments ma
            WHERE ma.message_id = m.id
          ),
          '[]'::json
        ) AS attachments
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
      JOIN users peer ON peer.id = CASE WHEN c.participant_one = $1 THEN c.participant_two ELSE c.participant_one END
      JOIN users sender ON sender.id = m.sender_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC, m.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const res = await query(sql, values);
    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;

    return {
      query: rawQ,
      hasMore,
      results: rows.map((r) => ({
        messageId: r.id,
        conversationId: r.conversation_id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        senderUsername: r.sender_username,
        content: r.content,
        messageType: r.message_type,
        mediaUrl: r.media_url,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {},
        attachments: r.attachments || [],
        createdAt: r.created_at,
        peerUser: {
          id: r.peer_id,
          name: r.peer_name,
          fullName: r.peer_name,
          username: r.peer_username,
          avatarUrl: r.peer_avatar_url,
          isVerified: Boolean(r.peer_is_verified),
        },
      })),
    };
  }
}
