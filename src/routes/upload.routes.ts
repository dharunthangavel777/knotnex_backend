import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadImage, uploadVideo, uploadDocument } from '../middleware/upload.middleware';

const router = Router();

import { ChatUploadController } from '../controllers/chat-upload.controller';
import { uploadAudio, uploadChatMedia } from '../middleware/chat-upload.middleware';

router.post('/image', authenticate, uploadImage.single('file'), UploadController.uploadImage);
router.post('/video', authenticate, uploadVideo.single('file'), UploadController.uploadVideo);
router.post('/document', authenticate, uploadDocument.single('file'), UploadController.uploadDocument);
router.post('/audio', authenticate, uploadAudio.single('file'), ChatUploadController.uploadAudio);
router.post('/chat-media', authenticate, uploadChatMedia.single('file'), ChatUploadController.uploadChatMedia);
router.get('/signed-url', authenticate, UploadController.getSignedUrl);
router.post('/signed-upload-url', authenticate, UploadController.getSignedUploadUrl);
router.post('/upload-session', authenticate, UploadController.getSignedUploadUrl);
router.post('/upload-sessions', authenticate, UploadController.getSignedUploadUrl);
router.post('/batch-signed-upload-url', authenticate, UploadController.getBatchSignedUploadUrls);
router.put('/direct-put', authenticate, ChatUploadController.handleAuthenticatedDirectPut);

export default router;
