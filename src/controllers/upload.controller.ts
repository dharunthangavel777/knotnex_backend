import { Request, Response } from 'express';
import { UploadService } from '../services/upload.service';
import { ApiResponse } from '../utils/response.util';

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
}
