import { mediaBucket, privateBucket, adcStorage } from '../../config/storage';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { v4 as uuidv4 } from 'uuid';

export class CloudStorageIntegration {
  static async uploadFile(
    fileBuffer: Buffer,
    destinationPath: string,
    mimeType: string,
    isPublic: boolean = true
  ): Promise<string> {
    const bucketName = isPublic ? config.gcs.mediaBucket : config.gcs.privateBucket;
    const bucket = isPublic ? mediaBucket : privateBucket;
    const file = bucket.file(destinationPath);

    try {
      await file.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
        },
        resumable: false,
      });

      if (isPublic) {
        return `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
      }

      // Private files return bucket path, accessible via signed URL
      return `gs://${bucket.name}/${destinationPath}`;
    } catch (primaryError: any) {
      logger.warn('[CloudStorageIntegration] Primary storage upload failed, attempting Cloud Run ADC fallback', {
        destinationPath,
        error: primaryError.message,
      });

      // Attempt fallback using Cloud Run native Application Default Credentials (ADC)
      try {
        const fallbackBucket = adcStorage.bucket(bucketName);
        const fallbackFile = fallbackBucket.file(destinationPath);
        await fallbackFile.save(fileBuffer, {
          metadata: {
            contentType: mimeType,
          },
          resumable: false,
        });

        logger.info('[CloudStorageIntegration] Upload succeeded via Cloud Run ADC fallback', {
          destinationPath,
        });

        if (isPublic) {
          return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
        }
        return `gs://${bucketName}/${destinationPath}`;
      } catch (adcError: any) {
        logger.error('Failed to upload file to Cloud Storage (both primary and ADC failed)', {
          destinationPath,
          primaryError: primaryError.message,
          adcError: adcError.message,
        });
        throw primaryError;
      }
    }
  }

  static async getSignedUrl(filePath: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      const cleanPath = filePath.replace(/^gs:\/\/[^\/]+\//, '');
      const file = privateBucket.file(cleanPath);

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      return url;
    } catch (error: any) {
      logger.error('Failed to generate signed URL', { filePath, error: error.message });
      throw error;
    }
  }

  static async generateSignedUploadUrl(
    destinationPath: string,
    contentType: string,
    isPublic: boolean = true,
    expiresInMinutes: number = 15
  ): Promise<{ uploadUrl: string; publicUrl: string; destinationPath: string }> {
    try {
      const bucket = isPublic ? mediaBucket : privateBucket;
      const file = bucket.file(destinationPath);

      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
        contentType,
      });

      const publicUrl = isPublic
        ? `https://storage.googleapis.com/${bucket.name}/${destinationPath}`
        : `gs://${bucket.name}/${destinationPath}`;

      return {
        uploadUrl,
        publicUrl,
        destinationPath,
      };
    } catch (error: any) {
      logger.error('Failed to generate signed upload URL', { destinationPath, contentType, error: error.message });
      throw error;
    }
  }

  static async deleteFile(filePath: string, isPublic: boolean = true): Promise<void> {
    try {
      const bucket = isPublic ? mediaBucket : privateBucket;
      const cleanPath = filePath.replace(/^https:\/\/storage\.googleapis\.com\/[^\/]+\//, '').replace(/^gs:\/\/[^\/]+\//, '');
      await bucket.file(cleanPath).delete({ ignoreNotFound: true });
      logger.info('File deleted from Cloud Storage', { cleanPath });
    } catch (error: any) {
      logger.error('Failed to delete file from Cloud Storage', { filePath, error: error.message });
      throw error;
    }
  }
}
