import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validator.middleware';
import {
  authOtpRateLimiter,
  authSigninRateLimiter,
} from '../middleware/rateLimiter.middleware';
import { signupSchema, sendOtpSchema, verifyOtpSchema, forgotPasswordSchema } from '../validators/auth.validator';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', authSigninRateLimiter, validate(signupSchema), AuthController.signup);
router.post('/send-otp', authOtpRateLimiter, validate(sendOtpSchema), AuthController.sendOtp);
router.post('/verify-otp', authOtpRateLimiter, validate(verifyOtpSchema), AuthController.verifyOtp);
router.post('/forgot-password', authOtpRateLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/logout', authenticate, AuthController.logout);

export default router;
