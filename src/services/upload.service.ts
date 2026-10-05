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

  static async getPrivateSignedUrl(filePath: string) {
    return await CloudStorageIntegration.getSignedUrl(filePath);
  }

  static async deleteFile(filePath: string, isPublic: boolean = true) {
    await CloudStorageIntegration.deleteFile(filePath, isPublic);
    return { success: true };
  }
}
