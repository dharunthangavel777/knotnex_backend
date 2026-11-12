import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatMediaService } from '../services/chat-media.service';
import { UploadService } from '../services/upload.service';
import { privateBucket } from '../config/storage';
import { ApiResponse } from '../utils/response.util';
import {
  ChatMediaKind,
  inferAttachmentKind,
  isAllowedChatMimeAndExtension,
  maxSizeForKind,
  sanitizeFilename,
  sanitizeFolder,
} from '../utils/media-validation.util';

export class ChatUploadController {
  /**
   * Dedicated authenticated audio/voice upload endpoint (`POST /uploads/audio`).
   */
  static async uploadAudio(req: Request, res: Response) {
    try {
      const uploaderId = req.user!.id;
      if (!req.file) {
        return ApiResponse.error(res, 'No audio file uploaded', 400, 'BAD_REQUEST');
      }

      const conversationId = (req.body?.conversationId as string | undefined) || null;
      const durationMsRaw = req.body?.durationMs;
      const durationMs = durationMsRaw !== undefined ? parseInt(String(durationMsRaw), 10) : null;

      let waveform: number[] | null = null;
      if (req.body?.waveform) {
        try {
          const parsed =
            typeof req.body.waveform === 'string'
              ? JSON.parse(req.body.waveform)
              : req.body.waveform;
          if (Array.isArray(parsed)) {
            waveform = parsed
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n))
              .slice(0, 120);
          }
        } catch {
          waveform = null;
        }
      }

      const stored = await ChatMediaService.savePrivateChatAsset({
        uploaderId,
        buffer: req.file.buffer,
        originalFilename: req.file.originalname || `voice_${Date.now()}.m4a`,
        mimeType: req.file.mimetype || 'audio/mp4',
        folder: 'chat/voice',
        attachmentType: 'voice',
        conversationId,
        durationMs: Number.isFinite(durationMs as number) ? durationMs : null,
        waveform,
      });

      return ApiResponse.success(res, stored, 'Voice note uploaded securely');
    } catch (error: any) {
      const code = error.statusCode || 400;
      return res.status(code).json({
        success: false,
        error: { code: 'AUDIO_UPLOAD_FAILED', message: error.message || 'Audio upload failed' },
      });
    }
  }

  /**
   * Unified private chat attachment upload (`POST /uploads/chat-media`) supporting
   * image, video, voice/audio, and documents with strict validation.
   */
  static async uploadChatMedia(req: Request, res: Response) {
    try {
      const uploaderId = req.user!.id;
      if (!req.file) {
        return ApiResponse.error(res, 'No file uploaded', 400, 'BAD_REQUEST');
      }

      const requestedKind = req.body?.attachmentType as ChatMediaKind | undefined;
      const cleanName = sanitizeFilename(req.file.originalname || 'attachment');
      const kind = requestedKind || inferAttachmentKind(req.file.mimetype, cleanName);

      const width = req.body?.width ? parseInt(String(req.body.width), 10) : null;
      const height = req.body?.height ? parseInt(String(req.body.height), 10) : null;
      const durationMs = req.body?.durationMs ? parseInt(String(req.body.durationMs), 10) : null;

      const stored = await ChatMediaService.savePrivateChatAsset({
        uploaderId,
        buffer: req.file.buffer,
        originalFilename: cleanName,
        mimeType: req.file.mimetype,
        folder: sanitizeFolder(req.body?.folder, `chat/${kind}`),
        attachmentType: kind,
        conversationId: (req.body?.conversationId as string | undefined) || null,
        width: Number.isFinite(width as number) ? width : null,
        height: Number.isFinite(height as number) ? height : null,
        durationMs: Number.isFinite(durationMs as number) ? durationMs : null,
      });

      return ApiResponse.success(res, stored, 'Chat media uploaded securely');
    } catch (error: any) {
      const code = error.statusCode || 400;
      return res.status(code).json({
        success: false,
        error: { code: 'CHAT_MEDIA_UPLOAD_FAILED', message: error.message || 'Chat media upload failed' },
      });
    }
  }

  /**
   * Issues either a short-lived GCS signed PUT URL into `privateBucket` or an
   * HMAC-signed authenticated `/uploads/direct-put` fallback for private chat media.
   */
  static async handleSignedUploadUrlRequest(req: Request, res: Response): Promise<boolean> {
    const isPublic = req.body?.isPublic !== false && req.body?.isPublic !== 'false';
    const folder = String(req.body?.folder || '');
    const isChatPrivate = !isPublic || folder.startsWith('chat');
    if (!isChatPrivate) {
      return false;
    }

    const uploaderId = req.user!.id;
    const rawName = String(req.body?.fileName || req.body?.filename || `file_${Date.now()}`);
    const cleanName = sanitizeFilename(rawName);
    const contentType = String(req.body?.contentType || 'application/octet-stream')
      .toLowerCase()
      .split(';')[0]
      .trim();
    const kind =
      (req.body?.attachmentType as ChatMediaKind | undefined) ||
      inferAttachmentKind(contentType, cleanName);

    if (!isAllowedChatMimeAndExtension(contentType, cleanName, kind)) {
      ApiResponse.error(res, `Unsupported file type (${contentType}) for chat ${kind}`, 400, 'UNSUPPORTED_MEDIA_TYPE');
      return true;
    }

    const fileSize = req.body?.fileSizeBytes ? Number(req.body.fileSizeBytes) : 0;
    if (fileSize > maxSizeForKind(kind)) {
      ApiResponse.error(res, `File size exceeds limit for ${kind}`, 400, 'PAYLOAD_TOO_LARGE');
      return true;
    }

    const assetId = uuidv4();
    const safeFolder = sanitizeFolder(folder, `chat/${kind}`);
    const now = new Date();
    const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const dotIdx = cleanName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? cleanName.slice(dotIdx) : '';
    const base = dotIdx >= 0 ? cleanName.slice(0, dotIdx) : cleanName;
    const storagePath = `${safeFolder}/${ym}/${assetId}_${base.slice(0, 60)}${ext}`;

    const exp = Date.now() + 15 * 60 * 1000;
    const sig = ChatMediaService.createUploadTokenSignature({
      assetId,
      uploaderId,
      storagePath,
      mimeType: contentType,
      exp,
    });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host') || 'localhost:8080';
    const directPutUrl =
      `${protocol}://${host}/api/v1/uploads/direct-put` +
      `?assetId=${encodeURIComponent(assetId)}` +
      `&key=${encodeURIComponent(storagePath)}` +
      `&fileName=${encodeURIComponent(cleanName)}` +
      `&contentType=${encodeURIComponent(contentType)}` +
      `&attachmentType=${encodeURIComponent(kind)}` +
      `&isPublic=false` +
      `&exp=${exp}&sig=${encodeURIComponent(sig)}`;

    const mediaUrl = `/api/v1/chat/media/${assetId}/content`;

    try {
      const [uploadUrl] = await privateBucket.file(storagePath).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: exp,
        contentType,
      });

      // Pre-register asset record owned by uploader so it can be resolved cleanly
      await ChatMediaService.upsertAssetRecord({
        assetId,
        uploaderId,
        attachmentType: kind,
        storageProvider: 'gcs_private',
        storagePath,
        originalFilename: cleanName,
        mimeType: contentType,
        fileSizeBytes: fileSize || 0,
        isPrivate: true,
      });

      ApiResponse.success(
        res,
        {
          assetId,
          uploadUrl,
          publicUrl: mediaUrl,
          mediaUrl,
          storagePath,
          storageProvider: 'gcs_private',
          attachmentType: kind,
          isPrivate: true,
          fallbackUploadUrl: directPutUrl,
          uploadMethod: 'PUT',
        },
        'Private upload URL generated'
      );
      return true;
    } catch {
      ApiResponse.success(
        res,
        {
          assetId,
          uploadUrl: directPutUrl,
          publicUrl: mediaUrl,
          mediaUrl,
          storagePath,
          storageProvider: 'server_direct_put',
          attachmentType: kind,
          isPrivate: true,
          uploadMethod: 'PUT',
        },
        'Authenticated direct upload URL generated'
      );
      return true;
    }
  }

  /**
   * Handles authenticated `PUT /uploads/direct-put` for both private chat assets
   * (magic-byte verified & private-stored) and fallback public uploads.
   */
  static async handleAuthenticatedDirectPut(req: Request, res: Response) {
    try {
      const uploaderId = req.user!.id;
      const isPublic = req.query.isPublic !== 'false';
      const rawKey = String(req.query.key || '');
      const isChatPrivate = !isPublic || rawKey.startsWith('chat/');

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const maxAllowed = 105 * 1024 * 1024; // Hard stream guard 105 MB

      req.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= maxAllowed) {
          chunks.push(chunk);
        }
      });

      req.on('end', async () => {
        try {
          if (totalBytes > maxAllowed) {
            return ApiResponse.error(res, 'Upload payload exceeds maximum permitted size', 400, 'PAYLOAD_TOO_LARGE');
          }
          const buffer = Buffer.concat(chunks);
          const contentType = String(
            req.query.contentType || req.headers['content-type'] || 'application/octet-stream'
          )
            .split(';')[0]
            .trim();
          const originalName = String(
            req.query.fileName || (rawKey ? rawKey.split('/').pop() : `upload_${Date.now()}`)
          );

          if (isChatPrivate) {
            const assetId = req.query.assetId ? String(req.query.assetId) : undefined;
            const kind =
              (req.query.attachmentType as ChatMediaKind | undefined) ||
              inferAttachmentKind(contentType, originalName);

            const stored = await ChatMediaService.savePrivateChatAsset({
              uploaderId,
              assetId,
              buffer,
              originalFilename: originalName,
              mimeType: contentType,
              folder: rawKey.includes('/')
                ? sanitizeFolder(rawKey.split('/').slice(0, 2).join('/'), `chat/${kind}`)
                : `chat/${kind}`,
              attachmentType: kind,
            });
            return ApiResponse.success(res, stored, 'Private chat media uploaded');
          }

          // Public non-chat upload via authenticated UploadService
          const safeFolder = sanitizeFolder(
            rawKey.includes('/') ? rawKey.split('/')[0] : 'media',
            'media'
          );
          const pseudoFile = {
            fieldname: 'file',
            originalname: sanitizeFilename(originalName),
            encoding: '7bit',
            mimetype: contentType,
            buffer,
            size: buffer.length,
          } as Express.Multer.File;
          const result = await UploadService.uploadMedia(pseudoFile, safeFolder, true);
          return ApiResponse.success(res, result, 'Media uploaded');
        } catch (innerErr: any) {
          const code = innerErr.statusCode || 400;
          return res.status(code).json({
            success: false,
            error: { code: 'DIRECT_PUT_FAILED', message: innerErr.message || 'Direct upload failed' },
          });
        }
      });

      req.on('error', (err) => {
        if (!res.headersSent) {
          ApiResponse.error(res, 'Upload stream interrupted: ' + err.message, 400);
        }
      });
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Direct upload failed', 500);
    }
  }
}
