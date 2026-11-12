import multer from 'multer';
import { MAX_CHAT_AUDIO_SIZE, MAX_CHAT_VIDEO_SIZE } from '../utils/media-validation.util';

const memoryStorage = multer.memoryStorage();

export const uploadAudio = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_CHAT_AUDIO_SIZE,
    files: 1,
  },
});

export const uploadChatMedia = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_CHAT_VIDEO_SIZE,
    files: 1,
  },
});

