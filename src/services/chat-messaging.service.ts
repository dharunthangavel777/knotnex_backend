import { pool, query } from '../config/database';
import { getSocketIO } from '../websockets/socket.server';
import { logger } from '../config/logger';
import { PresenceService } from './presence.service';

export interface AttachmentInput {
  assetId?: string;
  attachmentType: 'image' | 'video' | 'voice' | 'audio' | 'document';
  mediaUrl?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  waveform?: number[];
  metadata?: Record<string, any>;
}

export interface SendMessageV2Input {
  conversationId?: string;
  senderId: string;
  recipientId?: string;
  content: string;
  messageType?: string;
  mediaUrl?: string;
  replyToId?: string;
  clientMessageId?: string;
  forwardedFromMessageId?: string;
  forwardedFromUserId?: string;
  isForwarded?: boolean;
  metadata?: Record<string, any>;
  attachments?: AttachmentInput[];
}

const LOCAL_PATH_PREFIXES = ['file://', '/data/', '/storage/', '/var/', 'C:\\', 'D:\\', 'c:\\'];

function isUnsafeLocalFilePath(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return LOCAL_PATH_PREFIXES.some((p) => trimmed.startsWith(p));
}

function textSummary(
  messageType: string,
  content: string,
  attachmentsCount: number,
  attachmentTypes: string[],
  metaObj?: Record<string, any>
): string {
  const cleanText = (content || '').trim();
  if (messageType === 'voice' || messageType === 'audio') return 'Voice message';
  if (messageType === 'document' || messageType === 'file') {
    return cleanText || metaObj?.fileName || 'Document';
  }
  if (messageType === 'video') return cleanText || 'Video';
  if (messageType === 'image') return cleanText || 'Photo';
  if (messageType === 'media_group') {
    if (cleanText.length > 0) return cleanText;
    const allVideos = attachmentTypes.length > 0 && attachmentTypes.every((t) => t === 'video');
    const allImages = attachmentTypes.length > 0 && attachmentTypes.every((t) => t === 'image');
    if (allVideos) return `${attachmentsCount} videos`;
    if (allImages) return `${attachmentsCount} photos`;
    return `${attachmentsCount} attachments`;
  }
  if (messageType === 'post') return `Shared a post`;
  if (messageType === 'reel') return `Shared a reel: ${metaObj?.sharedTitle || 'Reel'}`;
  if (messageType === 'profile') return `Shared a profile`;
  return cleanText || 'New message';
}

function parseCompositeCursor(raw?: string): { createdAt: string; id?: string } | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.includes('::')) {
    const [ts, id] = trimmed.split('::');
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      return {
        createdAt: d.toISOString(),
        id: /^[0-9a-f-]{36}$/i.test(id || '') ? id : undefined,
      };
    }
  }
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return { createdAt: d.toISOString() };
  }
  return null;
}

const MESSAGE_PROJECTION_SQL = `
  SELECT
    m.*,
    sender.full_name AS sender_name,
    sender.username AS sender_username,
    sender.avatar_url AS sender_avatar_url,
    COALESCE(s_org.is_verified, sender.is_verified, FALSE) AS sender_is_verified,
    fwd_user.full_name AS forwarded_from_name,
    fwd_user.username AS forwarded_from_username,
    reply_m.content AS reply_to_content,
    reply_m.message_type AS reply_to_type,
    COALESCE(reply_m.deleted_for_everyone, reply_m.is_deleted, FALSE) AS reply_to_deleted,
    reply_u.full_name AS reply_to_sender_name,
    COALESCE(
      (
        SELECT jsonb_object_agg(mr.user_id, mr.emoji)
        FROM message_reactions mr
        WHERE mr.message_id = m.id
      ),
      '{}'::jsonb
    ) AS reactions_agg,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', ma.id,
            'assetId', ma.asset_id,
            'attachmentIndex', ma.attachment_index,
            'attachmentType', ma.attachment_type,
            'storageProvider', ma.storage_provider,
            'mediaUrl', ma.media_url,
            'thumbnailUrl', ma.thumbnail_url,
            'originalFilename', ma.original_filename,
            'mimeType', ma.mime_type,
            'fileSizeBytes', ma.file_size_bytes,
            'width', ma.width,
            'height', ma.height,
            'durationMs', ma.duration_ms,
            'waveform', ma.waveform,
            'uploadStatus', ma.upload_status
          )
          ORDER BY ma.attachment_index ASC
        )
        FROM message_attachments ma
        WHERE ma.message_id = m.id
      ),
      '[]'::json
    ) AS attachments
  FROM messages m
  JOIN users sender ON sender.id = m.sender_id
  LEFT JOIN organizations s_org ON s_org.owner_id = sender.id
  LEFT JOIN users fwd_user ON fwd_user.id = m.forwarded_from_user_id
  LEFT JOIN messages reply_m ON reply_m.id = m.reply_to_id
  LEFT JOIN users reply_u ON reply_u.id = reply_m.sender_id
`;

export class ChatMessagingService {
  static async getAuthorizedPeerId(conversationId: string, userId: string): Promise<string | null> {
    const res = await query(
      `SELECT participant_one, participant_two
       FROM conversations
       WHERE id = $1 AND (participant_one = $2 OR participant_two = $2)
       LIMIT 1`,
      [conversationId, userId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return row.participant_one === userId ? String(row.participant_two) : String(row.participant_one);
  }

  /**
   * Hydrates normalized rows from `messages` + `message_attachments` + `reply_to` + `message_reactions`.
   */
  static async hydrateMessageById(messageId: string, viewerId?: string) {
    const res = await query(`${MESSAGE_PROJECTION_SQL} WHERE m.id = $1 LIMIT 1`, [messageId]);
    if (res.rows.length === 0) return null;
    return this.formatMessageRow(res.rows[0], viewerId);
  }

  static formatMessageRow(row: any, _viewerId?: string) {
    const metadata =
      typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata || {};
    const reactionsAgg =
      typeof row.reactions_agg === 'string'
        ? JSON.parse(row.reactions_agg || '{}')
        : row.reactions_agg || {};

    const deletedForEveryone = Boolean(row.deleted_for_everyone || row.is_deleted);
    const attachments = deletedForEveryone
      ? []
      : Array.isArray(row.attachments)
        ? row.attachments
        : [];

    const firstAtt = attachments.length > 0 ? attachments[0] : null;
    const resolvedMediaUrl = deletedForEveryone ? null : firstAtt?.mediaUrl || row.media_url || null;

    let sendStatus = row.send_status || 'sent';
    if (row.is_read || row.read_at) {
      sendStatus = 'seen';
    } else if ((row.delivered_at || row.is_delivered) && sendStatus === 'sent') {
      sendStatus = 'delivered';
    }

    return {
      id: row.id,
      conversationId: row.conversation_id,
      conversation_id: row.conversation_id,
      senderId: row.sender_id,
      sender_id: row.sender_id,
      receiverId: row.receiver_id,
      receiver_id: row.receiver_id,
      senderName: row.sender_name,
      senderUsername: row.sender_username,
      senderAvatarUrl: row.sender_avatar_url,
      senderIsVerified: Boolean(row.sender_is_verified),
      clientMessageId: row.client_message_id || null,
      client_message_id: row.client_message_id || null,
      content: deletedForEveryone ? 'This message was deleted' : row.content || '',
      messageType: row.message_type || 'text',
      message_type: row.message_type || 'text',
      mediaUrl: resolvedMediaUrl,
      media_url: resolvedMediaUrl,
      attachments,
      replyToId: row.reply_to_id || null,
      reply_to_id: row.reply_to_id || null,
      replyToContent: row.reply_to_deleted ? 'This message was deleted' : row.reply_to_content || null,
      replyToSenderName: row.reply_to_sender_name || null,
      replyToType: row.reply_to_type || null,
      reactions: reactionsAgg,
      isRead: Boolean(row.is_read || row.read_at),
      is_read: Boolean(row.is_read || row.read_at),
      readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
      read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
      isDelivered: Boolean(row.is_delivered || row.delivered_at || row.is_read),
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
      sendStatus,
      isForwarded: Boolean(row.is_forwarded),
      forwardedFromMessageId: row.forwarded_from_message_id || null,
      forwardedFromUserId: row.forwarded_from_user_id || null,
      forwardedFromName: row.forwarded_from_name || null,
      isDeletedForEveryone: deletedForEveryone,
      deletedForEveryone: deletedForEveryone,
      deleted_for_everyone: deletedForEveryone,
      metadata: deletedForEveryone ? {} : metadata,
      sharedTitle: metadata.sharedTitle,
      sharedSubtitle: metadata.sharedSubtitle,
      sharedAvatar: metadata.sharedAvatar,
      sharedId: metadata.sharedId,
      sharedActionText: metadata.sharedActionText,
      sharedData: metadata.sharedData,
      fileName: metadata.fileName || firstAtt?.originalFilename,
      fileSize: metadata.fileSize,
      fileExtension: metadata.fileExtension,
      timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Sends a message idempotently inside a PostgreSQL transaction.
   * Guarantees one logical message + single Socket.IO broadcast per recipient + mute-aware push.
   */
  static async sendMessageIdempotent(
    input: SendMessageV2Input,
    options?: {
      onNewMessagePush?: (params: {
        conversationId: string;
        senderId: string;
        recipientId: string;
        messageId: string;
        content: string;
        messageType: string;
      }) => Promise<void>;
    }
  ) {
    const senderId = input.senderId;
    const clientMessageId = input.clientMessageId ? String(input.clientMessageId).trim().slice(0, 128) : null;

    if (isUnsafeLocalFilePath(input.mediaUrl)) {
      const err: any = new Error('Media upload did not complete before sending');
      err.statusCode = 400;
      throw err;
    }

    const attachmentsInput = Array.isArray(input.attachments) ? input.attachments : [];
    for (const att of attachmentsInput) {
      if (isUnsafeLocalFilePath(att.mediaUrl)) {
        const err: any = new Error('One or more attachments have not finished uploading');
        err.statusCode = 400;
        throw err;
      }
    }

    if (
      !(input.content || '').trim() &&
      !input.mediaUrl &&
      attachmentsInput.length === 0 &&
      !['post', 'reel', 'profile'].includes(input.messageType || '')
    ) {
      const err: any = new Error('Message content or attachment is required');
      err.statusCode = 400;
      throw err;
    }

    // Fast path idempotency check
    if (clientMessageId) {
      const existingPre = await query(
        `SELECT id FROM messages WHERE sender_id = $1 AND client_message_id = $2 LIMIT 1`,
        [senderId, clientMessageId]
      );
      if (existingPre.rows.length > 0) {
        const existingMsg = await this.hydrateMessageById(existingPre.rows[0].id, senderId);
        return { message: existingMsg, deduplicated: true };
      }
    }

    const client = await pool.connect();
    let conversationId = input.conversationId;
    let recipientId = input.recipientId;
    let convStatus = 'ACCEPTED';
    let autoAccepted = false;
    let insertedMessageId: string | null = null;
    let deduplicated = false;
    let recipientIsMuted = false;
    let previewContent = '';

    try {
      await client.query('BEGIN');

      if (!conversationId) {
        if (!recipientId) {
          throw new Error('conversationId or recipientId is required');
        }
        const [p1, p2] = senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
        let convRes = await client.query(
          `SELECT * FROM conversations
           WHERE (participant_one = $1 AND participant_two = $2)
              OR (participant_one = $2 AND participant_two = $1)
           LIMIT 1`,
          [p1, p2]
        );
        if (convRes.rows.length === 0) {
          convRes = await client.query(
            `INSERT INTO conversations (participant_one, participant_two, status, initiator_id, last_message_at, created_at, updated_at)
             VALUES ($1, $2, 'REQUEST_PENDING', $3, NOW(), NOW(), NOW())
             ON CONFLICT (LEAST(participant_one, participant_two), GREATEST(participant_one, participant_two))
             DO UPDATE SET
               deleted_by = array_remove(COALESCE(conversations.deleted_by, '{}'), $3),
               updated_at = NOW()
             RETURNING *`,
            [p1, p2, senderId]
          );
        }
        const conv = convRes.rows[0];
        conversationId = String(conv.id);
        convStatus = conv.status || 'ACCEPTED';
      }

      const convCheck = await client.query(
        `SELECT * FROM conversations WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [conversationId]
      );
      if (convCheck.rows.length === 0) {
        const err: any = new Error('Conversation not found');
        err.statusCode = 404;
        throw err;
      }
      const conv = convCheck.rows[0];
      if (conv.participant_one !== senderId && conv.participant_two !== senderId) {
        const err: any = new Error('Unauthorized conversation access');
        err.statusCode = 403;
        throw err;
      }

      recipientId = conv.participant_one === senderId ? String(conv.participant_two) : String(conv.participant_one);
      convStatus = conv.status || 'ACCEPTED';

      // Enforce block status (`blocked_users`)
      const blockRes = await client.query(
        `SELECT 1 FROM blocked_users
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [senderId, recipientId]
      );
      if (blockRes.rows.length > 0 || convStatus === 'BLOCKED') {
        const err: any = new Error('Cannot send message: User communication is restricted');
        err.statusCode = 403;
        throw err;
      }

      if (convStatus === 'REJECTED') {
        const err: any = new Error('Cannot send message: This conversation request was declined.');
        err.statusCode = 403;
        throw err;
      }

      // If recipient replies to a pending request, automatically ACCEPT it
      if (convStatus === 'REQUEST_PENDING' && conv.initiator_id && conv.initiator_id !== senderId) {
        await client.query(`UPDATE conversations SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`, [
          conversationId,
        ]);
        convStatus = 'ACCEPTED';
        autoAccepted = true;
      }

      // Check idempotency inside transaction lock
      if (clientMessageId) {
        const dupRes = await client.query(
          `SELECT id FROM messages WHERE sender_id = $1 AND client_message_id = $2 LIMIT 1`,
          [senderId, clientMessageId]
        );
        if (dupRes.rows.length > 0) {
          insertedMessageId = dupRes.rows[0].id;
          deduplicated = true;
        }
      }

      let effectiveMessageType = (input.messageType || 'text').toLowerCase();
      if (effectiveMessageType === 'file') effectiveMessageType = 'document';
      if (attachmentsInput.length > 1) {
        effectiveMessageType = 'media_group';
      } else if (attachmentsInput.length === 1 && (!input.messageType || input.messageType === 'text')) {
        effectiveMessageType = attachmentsInput[0].attachmentType;
      }

      if (!deduplicated) {
        const firstUrl = input.mediaUrl || attachmentsInput[0]?.mediaUrl || null;
        const metaObj = input.metadata || {};
        const metadataJson = JSON.stringify(metaObj);

        const insertRes = await client.query(
          `INSERT INTO messages (
             conversation_id, sender_id, receiver_id, content, message_type,
             media_url, reply_to_id, client_message_id, send_status,
             is_forwarded, forwarded_from_message_id, forwarded_from_user_id, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', $9, $10, $11, $12::jsonb)
           ON CONFLICT (sender_id, client_message_id) WHERE client_message_id IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [
            conversationId,
            senderId,
            recipientId,
            input.content || '',
            effectiveMessageType,
            firstUrl,
            input.replyToId || null,
            clientMessageId,
            Boolean(input.isForwarded || input.forwardedFromMessageId),
            input.forwardedFromMessageId || null,
            input.forwardedFromUserId || null,
            metadataJson,
          ]
        );

        if (insertRes.rows.length === 0 && clientMessageId) {
          const conflictRes = await client.query(
            `SELECT id FROM messages WHERE sender_id = $1 AND client_message_id = $2 LIMIT 1`,
            [senderId, clientMessageId]
          );
          insertedMessageId = conflictRes.rows[0]?.id || null;
          deduplicated = true;
        } else {
          insertedMessageId = insertRes.rows[0].id;

          if (attachmentsInput.length > 0) {
            let firstAttachmentContentUrl: string | null = null;
            for (let i = 0; i < attachmentsInput.length; i++) {
              const item = attachmentsInput[i];
              let storageProvider = 'external';
              let storagePath: string | null = null;
              let origName = item.originalFilename || null;
              let mimeType = item.mimeType || null;
              let sizeBytes = item.fileSizeBytes ?? null;
              let width = item.width ?? null;
              let height = item.height ?? null;
              let durationMs = item.durationMs ?? null;
              let waveform = item.waveform ? JSON.stringify(item.waveform) : null;
              let thumbPath: string | null = null;
              let thumbUrl = item.thumbnailUrl || null;
              let assetId: string | null = null;

              if (item.assetId && /^[0-9a-f-]{36}$/i.test(item.assetId)) {
                const assetRes = await client.query(
                  `SELECT * FROM chat_media_assets
                   WHERE id = $1 AND (uploader_id = $2 OR EXISTS (
                     SELECT 1 FROM message_attachments ma2
                     JOIN conversations c2 ON c2.id = ma2.conversation_id
                     WHERE ma2.asset_id = $1 AND (c2.participant_one = $2 OR c2.participant_two = $2)
                   ))
                   LIMIT 1`,
                  [item.assetId, senderId]
                );
                if (assetRes.rows.length > 0) {
                  const a = assetRes.rows[0];
                  assetId = a.id;
                  storageProvider = a.storage_provider || 'gcs_private';
                  storagePath = a.storage_path;
                  origName = origName || a.original_filename;
                  mimeType = mimeType || a.mime_type;
                  sizeBytes = sizeBytes ?? (a.file_size_bytes ? Number(a.file_size_bytes) : null);
                  width = width ?? a.width;
                  height = height ?? a.height;
                  durationMs = durationMs ?? a.duration_ms;
                  if (!waveform && a.waveform) waveform = JSON.stringify(a.waveform);
                  thumbPath = a.thumbnail_path;
                  thumbUrl = thumbUrl || a.thumbnail_url;
                }
              }

              const placeholderUrl = item.mediaUrl || '/api/v1/chat/attachments/pending/content';
              const attInsert = await client.query(
                `INSERT INTO message_attachments (
                   message_id, conversation_id, asset_id, uploader_id, attachment_index,
                   attachment_type, storage_provider, storage_path, media_url,
                   thumbnail_path, thumbnail_url, original_filename, mime_type,
                   file_size_bytes, width, height, duration_ms, waveform, upload_status, metadata
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, 'uploaded', $19::jsonb)
                 RETURNING id`,
                [
                  insertedMessageId,
                  conversationId,
                  assetId,
                  senderId,
                  i,
                  item.attachmentType,
                  storageProvider,
                  storagePath,
                  placeholderUrl,
                  thumbPath,
                  thumbUrl,
                  origName,
                  mimeType,
                  sizeBytes,
                  width,
                  height,
                  durationMs,
                  waveform,
                  JSON.stringify(item.metadata || {}),
                ]
              );

              const attId = String(attInsert.rows[0].id);
              const canonicalUrl =
                assetId || storageProvider !== 'external'
                  ? `/api/v1/chat/attachments/${attId}/content`
                  : placeholderUrl;

              await client.query(`UPDATE message_attachments SET media_url = $2 WHERE id = $1`, [
                attId,
                canonicalUrl,
              ]);
              if (i === 0) firstAttachmentContentUrl = canonicalUrl;
            }

            if (firstAttachmentContentUrl) {
              await client.query(`UPDATE messages SET media_url = $2 WHERE id = $1`, [
                insertedMessageId,
                firstAttachmentContentUrl,
              ]);
            }
          } else if (input.mediaUrl && !['post', 'reel', 'profile'].includes(effectiveMessageType)) {
            const attType =
              effectiveMessageType === 'video' ||
              effectiveMessageType === 'voice' ||
              effectiveMessageType === 'audio' ||
              effectiveMessageType === 'document'
                ? effectiveMessageType
                : 'image';
            await client.query(
              `INSERT INTO message_attachments (
                 message_id, conversation_id, uploader_id, attachment_index,
                 attachment_type, storage_provider, media_url, original_filename, mime_type
               )
               VALUES ($1, $2, $3, 0, $4, 'external', $5, $6, $7)`,
              [
                insertedMessageId,
                conversationId,
                senderId,
                attType,
                input.mediaUrl,
                metaObj.fileName || null,
                metaObj.mimeType || null,
              ]
            );
          }

          previewContent = textSummary(
            effectiveMessageType,
            input.content || '',
            attachmentsInput.length,
            attachmentsInput.map((a) => a.attachmentType),
            metaObj
          );

          await client.query(
            `UPDATE conversations
             SET last_message = $1,
                 last_message_id = $2,
                 last_message_at = NOW(),
                 last_message_by = $3,
                 deleted_by = '{}',
                 unread_count_one = CASE WHEN participant_one = $4 THEN unread_count_one + 1 ELSE unread_count_one END,
                 unread_count_two = CASE WHEN participant_two = $4 THEN unread_count_two + 1 ELSE unread_count_two END,
                 updated_at = NOW()
             WHERE id = $5`,
            [previewContent, insertedMessageId, senderId, recipientId, conversationId]
          );

          await client.query(
            `INSERT INTO conversation_participants (conversation_id, user_id, unread_count, is_deleted, updated_at)
             VALUES ($1, $2, 0, FALSE, NOW())
             ON CONFLICT (conversation_id, user_id) DO UPDATE SET
               unread_count = 0,
               is_deleted = FALSE,
               updated_at = NOW()`,
            [conversationId, senderId]
          );

          const recLedger = await client.query(
            `INSERT INTO conversation_participants (conversation_id, user_id, unread_count, is_deleted, updated_at)
             VALUES ($1, $2, 1, FALSE, NOW())
             ON CONFLICT (conversation_id, user_id) DO UPDATE SET
               unread_count = conversation_participants.unread_count + 1,
               is_deleted = FALSE,
               updated_at = NOW()
             RETURNING is_muted, muted_until`,
            [conversationId, recipientId]
          );

          if (recLedger.rows.length > 0) {
            const row = recLedger.rows[0];
            recipientIsMuted =
              Boolean(row.is_muted) &&
              (!row.muted_until || new Date(row.muted_until).getTime() > Date.now());
          }
          if (!recipientIsMuted && Array.isArray(conv.muted_by) && conv.muted_by.includes(recipientId)) {
            recipientIsMuted = true;
          }
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    if (!insertedMessageId) {
      throw new Error('Failed to persist message');
    }

    const hydrated = await this.hydrateMessageById(insertedMessageId, senderId);

    if (!deduplicated && hydrated && recipientId && conversationId) {
      const io = getSocketIO();
      if (io) {
        if (autoAccepted) {
          io.to(`user:${senderId}`).to(`user:${recipientId}`).emit('request_accepted', { conversationId });
        }

        // Emit ONCE per connected socket across sender & recipient user rooms (zero duplicate fan-out)
        io.to(`user:${senderId}`).to(`user:${recipientId}`).emit('new_message', hydrated);

        if (convStatus === 'REQUEST_PENDING') {
          io.to(`user:${recipientId}`).emit('message_request', {
            conversationId,
            message: hydrated,
            senderId,
          });
        }

        const convUpdate = {
          conversationId,
          lastMessage: previewContent || hydrated.content,
          lastMessageAt: hydrated.createdAt,
          lastMessageTime: hydrated.createdAt,
          lastMessageType: hydrated.messageType,
          senderId,
          status: convStatus,
        };
        io.to(`user:${recipientId}`).to(`user:${senderId}`).emit('conversation_updated', convUpdate);
      }

      if (!recipientIsMuted && options?.onNewMessagePush) {
        options
          .onNewMessagePush({
            conversationId,
            senderId,
            recipientId,
            messageId: hydrated.id,
            content: hydrated.content,
            messageType: hydrated.messageType,
          })
          .catch((e) => logger.warn('[ChatMessagingService] Push error: ' + e?.message));
      }
    }

    return { message: hydrated, deduplicated };
  }

  /**
   * Keyset cursor-paginated conversation history (newest page on initial open,
   * scrolling upward loads older messages via `before`, search jump via `aroundMessageId`).
   */
  static async getConversationMessagesPaginated(
    currentUserId: string,
    targetId: string,
    opts: {
      limit?: number;
      before?: string;
      after?: string;
      aroundMessageId?: string;
    }
  ) {
    const limit = Math.min(Math.max(Number(opts.limit) || 35, 1), 100);

    const convRes = await query(
      `SELECT * FROM conversations
       WHERE id::text = $1
          OR (
            (participant_one = $2 AND participant_two::text = $1)
             OR (participant_two = $2 AND participant_one::text = $1)
          )
       LIMIT 1`,
      [targetId, currentUserId]
    );

    if (convRes.rows.length === 0) {
      const targetUserRes = await query(
        `SELECT u.id, u.full_name, u.username, u.avatar_url, up.bio,
                COALESCE(org.is_verified, u.is_verified, FALSE) AS is_verified,
                u.role, org.name AS org_name, org.logo_url AS org_logo
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id
         LEFT JOIN organizations org ON org.owner_id = u.id
         WHERE u.id::text = $1 LIMIT 1`,
        [targetId]
      );
      const u = targetUserRes.rows[0];
      const presenceMap = u
        ? await PresenceService.getPresenceForUsers(currentUserId, [String(u.id)])
        : {};
      const p = u ? presenceMap[String(u.id)] : undefined;

      return {
        conversationId: null,
        status: 'NEW',
        initiatorId: null,
        isMuted: false,
        mutedUntil: null,
        hasMore: false,
        hasMoreNewer: false,
        nextCursor: null,
        newerCursor: null,
        firstUnreadMessageId: null,
        unreadCount: 0,
        otherUser: u
          ? {
              id: u.id,
              name: u.org_name || u.full_name,
              username: u.username,
              avatarUrl: u.org_logo || u.avatar_url,
              bio: u.bio,
              isVerified: Boolean(u.is_verified),
              isOnline: p?.isOnline ?? false,
              lastSeenAt: p?.lastSeenAt ?? null,
              showOnlineStatus: p?.showOnlineStatus ?? true,
              showLastSeen: p?.showLastSeen ?? true,
              readReceiptsEnabled: p?.readReceiptsEnabled ?? true,
            }
          : null,
        messages: [],
      };
    }

    const conv = convRes.rows[0];
    if (conv.participant_one !== currentUserId && conv.participant_two !== currentUserId) {
      const err: any = new Error('Unauthorized conversation access');
      err.statusCode = 403;
      throw err;
    }

    const conversationId = String(conv.id);
    const otherUserId =
      conv.participant_one === currentUserId
        ? String(conv.participant_two)
        : String(conv.participant_one);

    const [peerUserRes, cpRes, presenceMap] = await Promise.all([
      query(
        `SELECT u.id, u.full_name, u.username, u.avatar_url, up.bio,
                COALESCE(org.is_verified, u.is_verified, FALSE) AS is_verified,
                u.role, org.name AS org_name, org.logo_url AS org_logo
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id
         LEFT JOIN organizations org ON org.owner_id = u.id
         WHERE u.id = $1 LIMIT 1`,
        [otherUserId]
      ),
      query(
        `SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 LIMIT 1`,
        [conversationId, currentUserId]
      ),
      PresenceService.getPresenceForUsers(currentUserId, [otherUserId]),
    ]);

    const peer = peerUserRes.rows[0];
    const cp = cpRes.rows[0];
    const p = presenceMap[otherUserId];

    let isMuted =
      Boolean(cp?.is_muted) ||
      (Array.isArray(conv.muted_by) && conv.muted_by.includes(currentUserId));
    const mutedUntil = cp?.muted_until ? new Date(cp.muted_until).toISOString() : null;
    if (isMuted && cp?.muted_until && new Date(cp.muted_until).getTime() <= Date.now()) {
      isMuted = false;
    }

    const baseWhere = `
      m.conversation_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM message_user_visibility muv
        WHERE muv.message_id = m.id AND muv.user_id = $2
      )
      ${cp?.cleared_before_at ? 'AND m.created_at > $3::timestamptz' : ''}
    `;

    let rowsAsc: any[] = [];
    let hasMore = false;
    let hasMoreNewer = false;

    if (opts.aroundMessageId) {
      const anchorRes = await query(
        `SELECT created_at, id FROM messages WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
        [opts.aroundMessageId, conversationId]
      );
      if (anchorRes.rows.length > 0) {
        const anchorTs = anchorRes.rows[0].created_at;
        const anchorId = anchorRes.rows[0].id;
        const half = Math.max(Math.floor(limit / 2), 10);

        const olderParams: any[] = cp?.cleared_before_at
          ? [conversationId, currentUserId, cp.cleared_before_at, anchorTs, anchorId, half + 1]
          : [conversationId, currentUserId, anchorTs, anchorId, half + 1];
        const tsIdx = cp?.cleared_before_at ? '$4' : '$3';
        const idIdx = cp?.cleared_before_at ? '$5' : '$4';
        const limIdx = cp?.cleared_before_at ? '$6' : '$5';

        const [olderRes, newerRes] = await Promise.all([
          query(
            `${MESSAGE_PROJECTION_SQL}
             WHERE ${baseWhere}
               AND (m.created_at, m.id) <= (${tsIdx}::timestamptz, ${idIdx}::uuid)
             ORDER BY m.created_at DESC, m.id DESC
             LIMIT ${limIdx}`,
            olderParams
          ),
          query(
            `${MESSAGE_PROJECTION_SQL}
             WHERE ${baseWhere}
               AND (m.created_at, m.id) > (${tsIdx}::timestamptz, ${idIdx}::uuid)
             ORDER BY m.created_at ASC, m.id ASC
             LIMIT ${limIdx}`,
            olderParams
          ),
        ]);

        hasMore = olderRes.rows.length > half;
        hasMoreNewer = newerRes.rows.length > half;
        const olderSlice = olderRes.rows.slice(0, half).reverse();
        const newerSlice = newerRes.rows.slice(0, half);
        rowsAsc = [...olderSlice, ...newerSlice];
      }
    }

    if (rowsAsc.length === 0 && opts.after) {
      const parsedAfter = parseCompositeCursor(opts.after);
      if (parsedAfter) {
        const qParams: any[] = cp?.cleared_before_at
          ? [conversationId, currentUserId, cp.cleared_before_at, parsedAfter.createdAt]
          : [conversationId, currentUserId, parsedAfter.createdAt];
        let cursorSql: string;
        const tsParam = `$${qParams.length}`;
        if (parsedAfter.id) {
          qParams.push(parsedAfter.id);
          cursorSql = `AND (m.created_at, m.id) > (${tsParam}::timestamptz, $${qParams.length}::uuid)`;
        } else {
          cursorSql = `AND m.created_at > ${tsParam}::timestamptz`;
        }
        qParams.push(limit + 1);
        const msgRes = await query(
          `${MESSAGE_PROJECTION_SQL}
           WHERE ${baseWhere} ${cursorSql}
           ORDER BY m.created_at ASC, m.id ASC
           LIMIT $${qParams.length}`,
          qParams
        );
        hasMoreNewer = msgRes.rows.length > limit;
        rowsAsc = msgRes.rows.slice(0, limit);
      }
    }

    if (rowsAsc.length === 0 && !opts.after) {
      const parsedBefore = parseCompositeCursor(opts.before);
      const qParams: any[] = cp?.cleared_before_at
        ? [conversationId, currentUserId, cp.cleared_before_at]
        : [conversationId, currentUserId];

      let cursorSql = '';
      if (parsedBefore) {
        qParams.push(parsedBefore.createdAt);
        const tsParam = `$${qParams.length}`;
        if (parsedBefore.id) {
          qParams.push(parsedBefore.id);
          cursorSql = `AND (m.created_at, m.id) < (${tsParam}::timestamptz, $${qParams.length}::uuid)`;
        } else {
          cursorSql = `AND m.created_at < ${tsParam}::timestamptz`;
        }
      }

      qParams.push(limit + 1);
      const msgRes = await query(
        `${MESSAGE_PROJECTION_SQL}
         WHERE ${baseWhere} ${cursorSql}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $${qParams.length}`,
        qParams
      );
      hasMore = msgRes.rows.length > limit;
      rowsAsc = msgRes.rows.slice(0, limit).reverse();
    }

    const formatted = rowsAsc.map((r) => this.formatMessageRow(r, currentUserId));
    const oldest = formatted.length > 0 ? formatted[0] : null;
    const newest = formatted.length > 0 ? formatted[formatted.length - 1] : null;
    const nextCursor = oldest ? `${oldest.createdAt}::${oldest.id}` : null;
    const newerCursor = newest ? `${newest.createdAt}::${newest.id}` : null;

    let firstUnreadMessageId: string | null = null;
    if (formatted.length > 0) {
      const firstUnread = formatted.find((m) => m.senderId !== currentUserId && !m.isRead);
      firstUnreadMessageId = firstUnread ? firstUnread.id : null;
    }

    return {
      conversationId,
      status: conv.status || 'ACCEPTED',
      initiatorId: conv.initiator_id || null,
      isMuted,
      mutedUntil,
      hasMore,
      hasMoreNewer,
      nextCursor,
      newerCursor,
      firstUnreadMessageId,
      unreadCount: Number(cp?.unread_count || 0),
      otherUser: peer
        ? {
            id: peer.id,
            name: peer.org_name || peer.full_name,
            username: peer.username,
            avatarUrl: peer.org_logo || peer.avatar_url,
            bio: peer.bio,
            isVerified: Boolean(peer.is_verified),
            isOnline: p?.isOnline ?? false,
            lastSeenAt: p?.lastSeenAt ?? null,
            showOnlineStatus: p?.showOnlineStatus ?? true,
            showLastSeen: p?.showLastSeen ?? true,
            readReceiptsEnabled: p?.readReceiptsEnabled ?? true,
          }
        : null,
      messages: formatted,
    };
  }

  /**
   * Marks messages read when user actively views a conversation, enforcing both users'
   * `read_receipts_enabled` privacy preference before broadcasting `message_read`.
   */
  static async markConversationAsRead(conversationId: string, viewerId: string) {
    const peerId = await this.getAuthorizedPeerId(conversationId, viewerId);
    if (!peerId) return { success: true, count: 0 };

    const latestPeerMsgRes = await query(
      `SELECT id FROM messages
       WHERE conversation_id = $1 AND sender_id <> $2
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [conversationId, viewerId]
    );
    const lastReadMsgId = latestPeerMsgRes.rows[0]?.id || null;

    const now = new Date();
    await query(
      `INSERT INTO conversation_participants (
         conversation_id, user_id, last_read_message_id, last_read_at, unread_count, updated_at
       )
       VALUES ($1, $2, $3, $4, 0, NOW())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET
         last_read_message_id = COALESCE($3, conversation_participants.last_read_message_id),
         last_read_at = $4,
         unread_count = 0,
         updated_at = NOW()`,
      [conversationId, viewerId, lastReadMsgId, now]
    );

    await query(
      `UPDATE conversations
       SET unread_count_one = CASE WHEN participant_one = $1 THEN 0 ELSE unread_count_one END,
           unread_count_two = CASE WHEN participant_two = $1 THEN 0 ELSE unread_count_two END,
           updated_at = NOW()
       WHERE id = $2`,
      [viewerId, conversationId]
    );

    const upd = await query(
      `UPDATE messages
       SET is_read = TRUE,
           read_at = COALESCE(read_at, $3),
           is_delivered = TRUE,
           delivered_at = COALESCE(delivered_at, $3),
           send_status = 'seen'
       WHERE conversation_id = $1
         AND sender_id <> $2
         AND (COALESCE(is_read, FALSE) = FALSE OR read_at IS NULL)
       RETURNING id`,
      [conversationId, viewerId, now]
    );

    const [viewerPrivacy, peerPrivacy] = await Promise.all([
      PresenceService.getPrivacySettings(viewerId),
      PresenceService.getPrivacySettings(peerId),
    ]);

    const io = getSocketIO();
    if (io) {
      io.to(`user:${viewerId}`).emit('conversation_read_local', {
        conversationId,
        unreadCount: 0,
      });

      if (viewerPrivacy.readReceiptsEnabled && peerPrivacy.readReceiptsEnabled && upd.rows.length > 0) {
        io.to(`user:${peerId}`).emit('message_read', {
          conversationId,
          readerId: viewerId,
          readAt: now.toISOString(),
          lastReadMessageId: lastReadMsgId,
        });
      }
    }

    return { success: true, count: upd.rowCount || 0, lastReadMessageId: lastReadMsgId };
  }

  static async markMessageDelivered(messageId: string, recipientId: string) {
    const res = await query(
      `UPDATE messages
       SET is_delivered = TRUE,
           delivered_at = COALESCE(delivered_at, NOW()),
           send_status = CASE WHEN send_status = 'sent' THEN 'delivered' ELSE send_status END
       WHERE id = $1
         AND sender_id <> $2
         AND receiver_id = $2
       RETURNING id, conversation_id, sender_id, delivered_at`,
      [messageId, recipientId]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      const io = getSocketIO();
      if (io) {
        io.to(`user:${row.sender_id}`).emit('message_delivered', {
          messageId: row.id,
          conversationId: row.conversation_id,
          deliveredAt: new Date(row.delivered_at).toISOString(),
        });
      }
    }
    return { success: true, delivered: res.rows.length > 0 };
  }

  /**
   * Deletes a message either strictly for the requester (`scope = 'me'`) or
   * for both participants (`scope = 'everyone'`, enforced for sender within 60 minutes).
   */
  static async deleteMessage(
    messageId: string,
    userId: string,
    scope: 'me' | 'everyone' = 'me'
  ) {
    const msgRes = await query(
      `SELECT m.*, c.participant_one, c.participant_two, c.last_message_id
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1 AND (c.participant_one = $2 OR c.participant_two = $2)
       LIMIT 1`,
      [messageId, userId]
    );
    if (msgRes.rows.length === 0) {
      const err: any = new Error('Message not found or access denied');
      err.statusCode = 404;
      throw err;
    }
    const row = msgRes.rows[0];

    if (scope === 'me') {
      await query(
        `INSERT INTO message_user_visibility (message_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [messageId, userId]
      );
      return { success: true, scope: 'me', messageId, conversationId: row.conversation_id };
    }

    if (row.sender_id !== userId) {
      const err: any = new Error('Only the sender can delete a message for everyone');
      err.statusCode = 403;
      throw err;
    }

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const maxWindowMs = 60 * 60 * 1000;
    if (ageMs > maxWindowMs) {
      const err: any = new Error('Delete for everyone is only allowed within 60 minutes of sending');
      err.statusCode = 403;
      throw err;
    }

    await query(
      `UPDATE messages
       SET deleted_for_everyone = TRUE,
           is_deleted = TRUE,
           deleted_at = NOW(),
           deleted_for_everyone_at = NOW(),
           deleted_for_everyone_by = $2,
           content = 'This message was deleted',
           media_url = NULL
       WHERE id = $1`,
      [messageId, userId]
    );
    await query(`DELETE FROM message_reactions WHERE message_id = $1`, [messageId]).catch(() => {});

    if (row.last_message_id === messageId) {
      await query(
        `UPDATE conversations SET last_message = 'Message deleted', updated_at = NOW() WHERE id = $1`,
        [row.conversation_id]
      );
    }

    const io = getSocketIO();
    if (io) {
      io.to(`user:${row.participant_one}`)
        .to(`user:${row.participant_two}`)
        .emit('message_deleted', {
          messageId,
          conversationId: row.conversation_id,
          scope: 'everyone',
          deletedBy: userId,
        });
    }

    return { success: true, scope: 'everyone', messageId, conversationId: row.conversation_id };
  }

  static async clearConversationForUser(conversationId: string, userId: string) {
    const peerId = await this.getAuthorizedPeerId(conversationId, userId);
    if (!peerId) {
      const err: any = new Error('Conversation not found or access denied');
      err.statusCode = 403;
      throw err;
    }

    const now = new Date();
    await query(
      `INSERT INTO conversation_participants (
         conversation_id, user_id, cleared_before_at, unread_count, updated_at
       )
       VALUES ($1, $2, $3, 0, NOW())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET
         cleared_before_at = $3,
         unread_count = 0,
         updated_at = NOW()`,
      [conversationId, userId, now]
    );

    await query(
      `UPDATE conversations
       SET unread_count_one = CASE WHEN participant_one = $1 THEN 0 ELSE unread_count_one END,
           unread_count_two = CASE WHEN participant_two = $1 THEN 0 ELSE unread_count_two END,
           updated_at = NOW()
       WHERE id = $2`,
      [userId, conversationId]
    );

    return { success: true, conversationId, clearedBeforeAt: now.toISOString() };
  }

  static async toggleMute(
    conversationId: string,
    userId: string,
    options?: { muted?: boolean; mutedUntil?: string | null }
  ) {
    const peerId = await this.getAuthorizedPeerId(conversationId, userId);
    if (!peerId) {
      const err: any = new Error('Conversation not found or access denied');
      err.statusCode = 403;
      throw err;
    }

    const cur = await query(
      `SELECT cp.is_muted, ($2::uuid = ANY(COALESCE(c.muted_by, '{}'::uuid[]))) AS legacy_muted
       FROM conversations c
       LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $2
       WHERE c.id = $1`,
      [conversationId, userId]
    );
    const currentMuted = Boolean(cur.rows[0]?.is_muted || cur.rows[0]?.legacy_muted);
    const nextMuted = options?.muted !== undefined ? Boolean(options.muted) : !currentMuted;
    const nextMutedUntil = nextMuted ? options?.mutedUntil || null : null;

    await query(
      `INSERT INTO conversation_participants (
         conversation_id, user_id, is_muted, muted_until, updated_at
       )
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET
         is_muted = $3,
         muted_until = $4,
         updated_at = NOW()`,
      [conversationId, userId, nextMuted, nextMutedUntil]
    );

    if (nextMuted) {
      await query(
        `UPDATE conversations
         SET muted_by = array_append(array_remove(COALESCE(muted_by, '{}'::uuid[]), $2::uuid), $2::uuid)
         WHERE id = $1`,
        [conversationId, userId]
      );
    } else {
      await query(
        `UPDATE conversations
         SET muted_by = array_remove(COALESCE(muted_by, '{}'::uuid[]), $2::uuid)
         WHERE id = $1`,
        [conversationId, userId]
      );
    }

    return { conversationId, isMuted: nextMuted, mutedUntil: nextMutedUntil };
  }

  /**
   * Forwards an authorized existing message + all its attachments to one or more recipients/conversations.
   */
  static async forwardMessage(
    sourceMessageId: string,
    userId: string,
    params: {
      targetConversationIds?: string[];
      targetRecipientIds?: string[];
      clientMessageIdPrefix?: string;
    },
    onNewMessagePush?: (p: any) => Promise<void>
  ) {
    const srcRes = await query(
      `SELECT m.*, c.participant_one, c.participant_two
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1
         AND (c.participant_one = $2 OR c.participant_two = $2)
         AND COALESCE(m.deleted_for_everyone, m.is_deleted, FALSE) = FALSE
         AND NOT EXISTS (
           SELECT 1 FROM message_user_visibility muv WHERE muv.message_id = m.id AND muv.user_id = $2
         )
       LIMIT 1`,
      [sourceMessageId, userId]
    );

    if (srcRes.rows.length === 0) {
      const err: any = new Error('Source message not found or cannot be forwarded');
      err.statusCode = 404;
      throw err;
    }

    const src = srcRes.rows[0];
    const attRes = await query(
      `SELECT * FROM message_attachments WHERE message_id = $1 ORDER BY attachment_index ASC`,
      [sourceMessageId]
    );

    const attachments: AttachmentInput[] = attRes.rows.map((a) => ({
      assetId: a.asset_id || undefined,
      attachmentType: a.attachment_type,
      mediaUrl: a.media_url,
      thumbnailUrl: a.thumbnail_url || undefined,
      originalFilename: a.original_filename || undefined,
      mimeType: a.mime_type || undefined,
      fileSizeBytes: a.file_size_bytes ? Number(a.file_size_bytes) : undefined,
      width: a.width ?? undefined,
      height: a.height ?? undefined,
      durationMs: a.duration_ms ?? undefined,
      waveform: Array.isArray(a.waveform) ? a.waveform : undefined,
    }));

    const targets: Array<{ conversationId?: string; recipientId?: string }> = [];
    for (const cid of params.targetConversationIds || []) {
      if (cid) targets.push({ conversationId: cid });
    }
    for (const rid of params.targetRecipientIds || []) {
      if (rid) targets.push({ recipientId: rid });
    }

    const created: any[] = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const cmId = params.clientMessageIdPrefix ? `${params.clientMessageIdPrefix}_${i}` : undefined;
      const res = await this.sendMessageIdempotent(
        {
          conversationId: t.conversationId,
          senderId: userId,
          recipientId: t.recipientId,
          content: src.content || '',
          messageType: src.message_type || 'text',
          mediaUrl: src.media_url || undefined,
          clientMessageId: cmId,
          isForwarded: true,
          forwardedFromMessageId: src.id,
          forwardedFromUserId: src.sender_id,
          metadata: typeof src.metadata === 'string' ? JSON.parse(src.metadata) : src.metadata || {},
          attachments,
        },
        { onNewMessagePush }
      );
      if (res.message) created.push(res.message);
    }

    return created;
  }
}
