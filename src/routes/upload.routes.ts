import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadImage, uploadVideo, uploadDocument } from '../middleware/upload.middleware';

const router = Router();

router.post('/image', authenticate, uploadImage.single('file'), UploadController.uploadImage);
router.post('/video', authenticate, uploadVideo.single('file'), UploadController.uploadVideo);
router.post('/document', authenticate, uploadDocument.single('file'), UploadController.uploadDocument);
router.get('/signed-url', authenticate, UploadController.getSignedUrl);
router.post('/signed-upload-url', authenticate, UploadController.getSignedUploadUrl);
router.post('/batch-signed-upload-url', authenticate, UploadController.getBatchSignedUploadUrls);
router.put('/direct-put', UploadController.handleDirectPut);

export default router;
