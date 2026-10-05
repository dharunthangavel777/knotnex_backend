import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validator.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';
import { signupSchema, sendOtpSchema, verifyOtpSchema, forgotPasswordSchema } from '../validators/auth.validator';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', authRateLimiter, validate(signupSchema), AuthController.signup);
router.post('/send-otp', authRateLimiter, validate(sendOtpSchema), AuthController.sendOtp);
router.post('/verify-otp', authRateLimiter, validate(verifyOtpSchema), AuthController.verifyOtp);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/logout', authenticate, AuthController.logout);

export default router;
