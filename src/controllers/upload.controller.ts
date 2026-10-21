import { Request, Response } from 'express';
import { UploadService } from '../services/upload.service';
import { ApiResponse } from '../utils/response.util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class UploadController {
  static async uploadImage(req: Request, res: Response) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No image file uploaded', 400, 'FILE_MISSING');
      }

      const folder = (req.body.folder as string) || 'images';
      const result = await UploadService.uploadMedia(req.file, folder, true);
      return ApiResponse.success(res, result, 'Image uploaded successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async uploadVideo(req: Request, res: Response) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No video file uploaded', 400, 'FILE_MISSING');
      }

      const folder = (req.body.folder as string) || 'videos';
      const result = await UploadService.uploadMedia(req.file, folder, true);
      return ApiResponse.success(res, result, 'Video uploaded successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async uploadDocument(req: Request, res: Response) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No document file uploaded', 400, 'FILE_MISSING');
      }

      const folder = (req.body.folder as string) || 'documents';
      // Documents (e.g. resumes, certificates) default to private storage
      const result = await UploadService.uploadMedia(req.file, folder, false);
      return ApiResponse.success(res, result, 'Document uploaded successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getSignedUploadUrl(req: Request, res: Response) {
    try {
      const { fileName, contentType, folder = 'posts', isPublic = true } = req.body;
      if (!fileName || !contentType) {
        return ApiResponse.error(res, 'fileName and contentType are required', 400);
      }

      const userId = req.user?.id || 'anonymous';
      const result = await UploadService.getSignedUploadUrl(
        userId,
        folder,
        fileName,
        contentType,
        isPublic
      );
      return ApiResponse.success(res, result, 'Signed upload URL generated successfully');
    } catch (error: any) {
      if (error.message?.includes('signBlob') || error.message?.includes('serviceAccounts')) {
        const folder = (req.body.folder as string) || 'posts';
        const contentType = req.body.contentType as string;
        const ext = path.extname(req.body.fileName) || (contentType?.includes('video') ? '.mp4' : '.jpg');
        const uniqueFileName = `${uuidv4()}${ext}`;
        const host = req.get('host') || 'knotnex-backend-389663780266.asia-south1.run.app';
        const protocol = req.protocol === 'http' && !req.get('x-forwarded-proto') ? 'http' : 'https';
        const uploadUrl = `${protocol}://${host}/api/v1/uploads/direct-put?folder=${folder}&fileName=${uniqueFileName}`;
        const publicUrl = `${protocol}://${host}/uploads/${folder}/${uniqueFileName}`;
        return ApiResponse.success(res, {
          uploadUrl,
          publicUrl,
          destinationPath: `${folder}/${uniqueFileName}`,
          fileName: uniqueFileName,
          contentType,
          expiresInMinutes: 15,
        }, 'Direct upload URL generated (signBlob fallback)');
      }
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getBatchSignedUploadUrls(req: Request, res: Response) {
    try {
      const { files, folder = 'posts', isPublic = true } = req.body;
      if (!Array.isArray(files) || files.length === 0) {
        return ApiResponse.error(res, 'files array is required and must not be empty', 400);
      }

      const userId = req.user?.id || 'anonymous';
      const results = await UploadService.getBatchSignedUploadUrls(
        userId,
        folder,
        files,
        isPublic
      );
      return ApiResponse.success(res, results, 'Batch signed upload URLs generated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getSignedUrl(req: Request, res: Response) {
    try {
      const filePath = req.query.path as string;
      if (!filePath) return ApiResponse.error(res, 'File path query required', 400);

      const url = await UploadService.getPrivateSignedUrl(filePath);
      return ApiResponse.success(res, { url });
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async handleDirectPut(req: Request, res: Response) {
    try {
      const folder = (req.query.folder as string) || 'posts';
      const fileName = (req.query.fileName as string) || `${uuidv4()}.bin`;

      const uploadDir = path.join(process.cwd(), 'uploads', folder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      const writeStream = fs.createWriteStream(filePath);

      req.pipe(writeStream);

      writeStream.on('finish', async () => {
        const host = req.get('host') || 'knotnex-backend-389663780266.asia-south1.run.app';
        const protocol = req.protocol === 'http' && !req.get('x-forwarded-proto') ? 'http' : 'https';
        let publicUrl = `${protocol}://${host}/uploads/${folder}/${fileName}`;

        try {
          const { mediaBucket } = await import('../config/storage');
          const destination = `${folder}/${fileName}`;
          await mediaBucket.upload(filePath, { destination, resumable: false });
          publicUrl = `https://storage.googleapis.com/${mediaBucket.name}/${destination}`;
        } catch {
          // Fall back to local serving URL if GCS bucket upload errors
        }

        return res.status(200).json({
          success: true,
          url: publicUrl,
        });
      });

      writeStream.on('error', (err) => {
        return res.status(500).json({ error: err.message });
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
