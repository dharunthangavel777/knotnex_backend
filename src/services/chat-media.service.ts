import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { config } from '../config';
import { privateBucket, mediaBucket } from '../config/storage';
import { logger } from '../config/logger';
import {
  ChatMediaKind,
  inferAttachmentKind,
  isAllowedChatMimeAndExtension,
  maxSizeForKind,
  sanitizeFilename,
  sanitizeFolder,
  verifyMagicBytes,
} from '../utils/media-validation.util';

export interface StoredChatAsset {
  assetId: string;
  url: string;
  attachmentType: ChatMediaKind;
  storageProvider: 'gcs_private' | 'local_private' | 'gcs_public';
  storagePath: string;
  mimeType: string;
  originalFilename: string;
  fileSizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  isPrivate: boolean;
}

const PRIVATE_UPLOADS_ROOT = path.resolve(process.cwd(), '.private_uploads');

function ensurePrivateDirFor(storagePath: string): string {
  const normalized = storagePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(PRIVATE_UPLOADS_ROOT, normalized);
  if (!resolved.startsWith(PRIVATE_UPLOADS_ROOT + path.sep) && resolved !== PRIVATE_UPLOADS_ROOT) {
    throw new Error('INVALID_STORAGE_PATH');
  }
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return resolved;
}

export class ChatMediaService {
  /**
   * Validates file buffer (type, extension, max size, magic bytes) and persists to
   * private GCS bucket (`privateBucket`) or private server disk fallback.
   */
  static async savePrivateChatAsset(params: {
    uploaderId: string;
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    folder?: string;
    attachmentType?: ChatMediaKind;
    conversationId?: string | null;
    assetId?: string;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
    waveform?: number[] | null;
  }): Promise<StoredChatAsset> {
    const cleanName = sanitizeFilename(params.originalFilename);
    const kind = params.attachmentType || inferAttachmentKind(params.mimeType, cleanName);
    const mime = (params.mimeType || 'application/octet-stream').toLowerCase().split(';')[0].trim();

    if (!isAllowedChatMimeAndExtension(mime, cleanName, kind)) {
      const err: any = new Error(`Unsupported ${kind} format (${mime || path.extname(cleanName)})`);
      err.statusCode = 400;
      throw err;
    }

    const maxBytes = maxSizeForKind(kind);
    if (!params.buffer || params.buffer.length === 0) {
      const err: any = new Error('Uploaded file is empty');
      err.statusCode = 400;
      throw err;
    }
    if (params.buffer.length > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      const err: any = new Error(`File exceeds maximum allowed size (${mb} MB) for ${kind}`);
      err.statusCode = 400;
      throw err;
    }

    if (!verifyMagicBytes(params.buffer, kind, mime, cleanName)) {
      const err: any = new Error('File content signature does not match declared file type');
      err.statusCode = 400;
      throw err;
    }

    const assetId = params.assetId && /^[0-9a-f-]{36}$/i.test(params.assetId) ? params.assetId : uuidv4();
    const safeFolder = sanitizeFolder(params.folder, `chat/${kind}`);
    const now = new Date();
    const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const ext = path.extname(cleanName);
    const baseWithoutExt = path.basename(cleanName, ext).slice(0, 60) || 'file';
    const uniqueKey = `${assetId}_${baseWithoutExt}${ext}`;
    const storagePath = `${safeFolder}/${ym}/${uniqueKey}`;

    let storageProvider: 'gcs_private' | 'local_private' = 'gcs_private';
    try {
      const gcsFile = privateBucket.file(storagePath);
      await gcsFile.save(params.buffer, {
        resumable: false,
        metadata: {
          contentType: mime,
          cacheControl: 'private, max-age=300',
          metadata: {
            uploaderId: params.uploaderId,
            assetId,
            originalFilename: cleanName,
          },
        },
      });
    } catch (gcsErr: any) {
      logger.warn(`[ChatMediaService] privateBucket upload failed, using local_private disk: ${gcsErr.message}`);
      storageProvider = 'local_private';
      const diskPath = ensurePrivateDirFor(storagePath);
      fs.writeFileSync(diskPath, params.buffer);
    }

    await this.upsertAssetRecord({
      assetId,
      uploaderId: params.uploaderId,
      conversationId: params.conversationId || null,
      attachmentType: kind,
      storageProvider,
      storagePath,
      originalFilename: cleanName,
      mimeType: mime,
      fileSizeBytes: params.buffer.length,
      width: params.width ?? null,
      height: params.height ?? null,
      durationMs: params.durationMs ?? null,
      waveform: params.waveform ?? null,
      isPrivate: true,
    });

    return {
      assetId,
      url: `/api/v1/chat/media/${assetId}/content`,
      attachmentType: kind,
      storageProvider,
      storagePath,
      mimeType: mime,
      originalFilename: cleanName,
      fileSizeBytes: params.buffer.length,
      width: params.width ?? null,
      height: params.height ?? null,
      durationMs: params.durationMs ?? null,
      isPrivate: true,
    };
  }

  static async upsertAssetRecord(input: {
    assetId: string;
    uploaderId: string;
    conversationId?: string | null;
    attachmentType: ChatMediaKind;
    storageProvider: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
    waveform?: number[] | null;
    isPrivate?: boolean;
  }): Promise<void> {
    await query(
      `INSERT INTO chat_media_assets (
         id, uploader_id, conversation_id, attachment_type, storage_provider,
         storage_path, original_filename, mime_type, file_size_bytes,
         width, height, duration_ms, waveform, is_private
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         storage_provider = EXCLUDED.storage_provider,
         storage_path = EXCLUDED.storage_path,
         original_filename = EXCLUDED.original_filename,
         mime_type = EXCLUDED.mime_type,
         file_size_bytes = EXCLUDED.file_size_bytes,
         width = COALESCE(EXCLUDED.width, chat_media_assets.width),
         height = COALESCE(EXCLUDED.height, chat_media_assets.height),
         duration_ms = COALESCE(EXCLUDED.duration_ms, chat_media_assets.duration_ms),
         waveform = COALESCE(EXCLUDED.waveform, chat_media_assets.waveform)`,
      [
        input.assetId,
        input.uploaderId,
        input.conversationId || null,
        input.attachmentType,
        input.storageProvider,
        input.storagePath,
        input.originalFilename,
        input.mimeType,
        input.fileSizeBytes,
        input.width ?? null,
        input.height ?? null,
        input.durationMs ?? null,
        input.waveform ? JSON.stringify(input.waveform) : null,
        input.isPrivate !== false,
      ]
    );
  }

  /**
   * Registers a pre-signed GCS PUT upload so the client owns its `assetId` even before
   * committing a message row.
   */
  static createUploadTokenSignature(payload: {
    assetId: string;
    uploaderId: string;
    storagePath: string;
    mimeType: string;
    exp: number;
  }): string {
    const raw = `${payload.assetId}|${payload.uploaderId}|${payload.storagePath}|${payload.mimeType}|${payload.exp}`;
    return crypto.createHmac('sha256', config.security.jwtSecret).update(raw).digest('hex');
  }

  static verifyUploadTokenSignature(
    payload: { assetId: string; uploaderId: string; storagePath: string; mimeType: string; exp: number },
    signature: string
  ): boolean {
    if (!signature || payload.exp < Date.now()) return false;
    const expected = this.createUploadTokenSignature(payload);
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Authorizes and streams a committed `message_attachments` item with HTTP Range support.
   */
  static async streamAuthorizedAttachment(
    req: Request,
    res: Response,
    attachmentId: string,
    userId: string
  ): Promise<void> {
    const attRes = await query(
      `SELECT
          ma.*,
          m.created_at AS message_created_at,
          m.deleted_for_everyone,
          c.participant_one,
          c.participant_two,
          cp.cleared_before_at
       FROM message_attachments ma
       JOIN messages m ON m.id = ma.message_id
       JOIN conversations c ON c.id = ma.conversation_id
       LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $2
       WHERE ma.id = $1
         AND (c.participant_one = $2 OR c.participant_two = $2)
         AND NOT EXISTS (
           SELECT 1 FROM message_user_visibility muv
           WHERE muv.message_id = m.id AND muv.user_id = $2
         )
       LIMIT 1`,
      [attachmentId, userId]
    );

    if (attRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'ATTACHMENT_NOT_FOUND', message: 'Attachment not found or access denied' },
      });
      return;
    }

    const att = attRes.rows[0];
    if (att.deleted_for_everyone) {
      res.status(410).json({
        success: false,
        error: { code: 'MESSAGE_DELETED', message: 'This message was deleted' },
      });
      return;
    }
    if (att.cleared_before_at && new Date(att.message_created_at) <= new Date(att.cleared_before_at)) {
      res.status(404).json({
        success: false,
        error: { code: 'ATTACHMENT_NOT_FOUND', message: 'Attachment not found' },
      });
      return;
    }

    await this.streamByProvider(req, res, {
      storageProvider: att.storage_provider,
      storagePath: att.storage_path,
      mediaUrl: att.media_url,
      mimeType: att.mime_type || 'application/octet-stream',
      originalFilename: att.original_filename || 'attachment',
      fileSizeBytes: att.file_size_bytes ? Number(att.file_size_bytes) : undefined,
      download: req.query.download === '1' || req.query.download === 'true',
    });
  }

  /**
   * Authorizes and streams an uploaded `chat_media_assets` item (either pre-send by uploader
   * or post-send by any conversation participant).
   */
  static async streamAuthorizedAsset(
    req: Request,
    res: Response,
    assetId: string,
    userId: string
  ): Promise<void> {
    const assetRes = await query(
      `SELECT cma.*
       FROM chat_media_assets cma
       WHERE cma.id = $1
         AND (
           cma.uploader_id = $2
           OR EXISTS (
             SELECT 1
             FROM message_attachments ma
             JOIN conversations c ON c.id = ma.conversation_id
             WHERE ma.asset_id = cma.id
               AND (c.participant_one = $2 OR c.participant_two = $2)
           )
         )
       LIMIT 1`,
      [assetId, userId]
    );

    if (assetRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'MEDIA_NOT_FOUND', message: 'Media asset not found or access denied' },
      });
      return;
    }

    const asset = assetRes.rows[0];
    await this.streamByProvider(req, res, {
      storageProvider: asset.storage_provider,
      storagePath: asset.storage_path,
      mimeType: asset.mime_type || 'application/octet-stream',
      originalFilename: asset.original_filename || 'attachment',
      fileSizeBytes: asset.file_size_bytes ? Number(asset.file_size_bytes) : undefined,
      download: req.query.download === '1' || req.query.download === 'true',
    });
  }

  static async getAuthorizedAttachmentSignedUrl(
    attachmentId: string,
    userId: string
  ): Promise<{ signedUrl: string; expiresInSeconds: number; storageProvider: string }> {
    const attRes = await query(
      `SELECT ma.*
       FROM message_attachments ma
       JOIN conversations c ON c.id = ma.conversation_id
       WHERE ma.id = $1
         AND (c.participant_one = $2 OR c.participant_two = $2)
       LIMIT 1`,
      [attachmentId, userId]
    );

    if (attRes.rows.length === 0) {
      const err: any = new Error('Attachment not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    const att = attRes.rows[0];
    if (att.storage_provider === 'gcs_private' && att.storage_path) {
      try {
        const [signedUrl] = await privateBucket.file(att.storage_path).getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 30 * 60 * 1000,
        });
        return { signedUrl, expiresInSeconds: 1800, storageProvider: 'gcs_private' };
      } catch (signErr: any) {
        logger.warn('[ChatMediaService] getSignedUrl fell back to content stream: ' + signErr.message);
      }
    }

    return {
      signedUrl: `/api/v1/chat/attachments/${attachmentId}/content`,
      expiresInSeconds: 3600,
      storageProvider: att.storage_provider || 'local_private',
    };
  }

  private static async streamByProvider(
    req: Request,
    res: Response,
    params: {
      storageProvider?: string;
      storagePath?: string | null;
      mediaUrl?: string | null;
      mimeType: string;
      originalFilename: string;
      fileSizeBytes?: number;
      download?: boolean;
    }
  ): Promise<void> {
    const provider = params.storageProvider || 'gcs_private';
    const dispositionType = params.download ? 'attachment' : 'inline';
    const safeDispName = encodeURIComponent(sanitizeFilename(params.originalFilename));

    if (provider === 'local_private' && params.storagePath) {
      const diskPath = ensurePrivateDirFor(params.storagePath);
      if (!fs.existsSync(diskPath)) {
        res.status(404).json({
          success: false,
          error: { code: 'FILE_MISSING', message: 'Media file no longer exists on server' },
        });
        return;
      }

      const stat = fs.statSync(diskPath);
      const totalSize = stat.size;
      const rangeHeader = req.headers.range;

      res.setHeader('Content-Type', params.mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('Content-Disposition', `${dispositionType}; filename*=UTF-8''${safeDispName}`);

      if (rangeHeader && /^bytes=\d+-\d*$/.test(rangeHeader)) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? Math.min(parseInt(endStr, 10), totalSize - 1) : totalSize - 1;
        if (start >= totalSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(diskPath, { start, end }).pipe(res);
        return;
      }

      res.status(200);
      res.setHeader('Content-Length', String(totalSize));
      fs.createReadStream(diskPath).pipe(res);
      return;
    }

    if ((provider === 'gcs_private' || provider === 'gcs_public') && params.storagePath) {
      const bucket = provider === 'gcs_public' ? mediaBucket : privateBucket;
      const gcsFile = bucket.file(params.storagePath);
      const [exists] = await gcsFile.exists();
      if (!exists) {
        res.status(404).json({
          success: false,
          error: { code: 'FILE_MISSING', message: 'Media file not found in cloud storage' },
        });
        return;
      }

      const [metadata] = await gcsFile.getMetadata();
      const totalSize = Number(metadata.size || params.fileSizeBytes || 0);
      const contentType = metadata.contentType || params.mimeType;
      const rangeHeader = req.headers.range;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('Content-Disposition', `${dispositionType}; filename*=UTF-8''${safeDispName}`);

      if (totalSize > 0 && rangeHeader && /^bytes=\d+-\d*$/.test(rangeHeader)) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? Math.min(parseInt(endStr, 10), totalSize - 1) : totalSize - 1;
        if (start >= totalSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        gcsFile
          .createReadStream({ start, end })
          .on('error', (err) => {
            logger.error('[ChatMediaService] GCS range stream error: ' + err.message);
            if (!res.headersSent) res.status(500).end();
          })
          .pipe(res);
        return;
      }

      res.status(200);
      if (totalSize > 0) res.setHeader('Content-Length', String(totalSize));
      gcsFile
        .createReadStream()
        .on('error', (err) => {
          logger.error('[ChatMediaService] GCS stream error: ' + err.message);
          if (!res.headersSent) res.status(500).end();
        })
        .pipe(res);
      return;
    }

    if (params.mediaUrl && params.mediaUrl.startsWith('https://')) {
      res.redirect(302, params.mediaUrl);
      return;
    }

    res.status(404).json({
      success: false,
      error: { code: 'MEDIA_UNAVAILABLE', message: 'Attachment storage location unavailable' },
    });
  }
}
