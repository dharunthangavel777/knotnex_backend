import { CloudStorageIntegration } from '../integrations/gcp/cloud-storage.gcp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export class UploadService {
  static async uploadMedia(file: Express.Multer.File, folder: string = 'media', isPublic: boolean = true) {
    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const destination = `${folder}/${fileName}`;

    const url = await CloudStorageIntegration.uploadFile(file.buffer, destination, file.mimetype, isPublic);

    return {
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
    };
  }

  static async getSignedUploadUrl(
    userId: string,
    folder: string = 'posts',
    originalFileName: string,
    contentType: string,
    isPublic: boolean = true
  ) {
    const ext = path.extname(originalFileName) || (contentType.includes('video') ? '.mp4' : '.jpg');
    const uniqueFileName = `${uuidv4()}${ext}`;
    const destinationPath = `${folder}/${userId}/${uniqueFileName}`;

    const result = await CloudStorageIntegration.generateSignedUploadUrl(
      destinationPath,
      contentType,
      isPublic,
      15
    );

    return {
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      destinationPath: result.destinationPath,
      fileName: uniqueFileName,
      contentType,
      expiresInMinutes: 15,
    };
  }

  static async getBatchSignedUploadUrls(
    userId: string,
    folder: string = 'posts',
    files: Array<{ fileName: string; contentType: string }>,
    isPublic: boolean = true
  ) {
    const results = await Promise.all(
      files.map((f) =>
        UploadService.getSignedUploadUrl(userId, folder, f.fileName, f.contentType, isPublic)
      )
    );
    return results;
  }

  static async getPrivateSignedUrl(filePath: string) {
    return await CloudStorageIntegration.getSignedUrl(filePath);
  }

  static async deleteFile(filePath: string, isPublic: boolean = true) {
    await CloudStorageIntegration.deleteFile(filePath, isPublic);
    return { success: true };
  }
}
