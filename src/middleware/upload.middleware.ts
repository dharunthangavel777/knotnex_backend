import multer from 'multer';
import { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_DOC_SIZE } from '../utils/file.util';

// Store files in memory buffer for streaming to GCP Cloud Storage
const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
});

export const uploadVideo = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_DOC_SIZE },
});
