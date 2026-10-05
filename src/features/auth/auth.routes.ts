import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validator.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import {
  authOtpRateLimiter,
  authSigninRateLimiter,
  authResetRateLimiter,
} from '../../middleware/rateLimiter.middleware';
import {
  initiateSignupSchema,
  verifySignupOtpSchema,
  completeSignupSchema,
  signinSchema,
  signupDirectSchema,
  forgotPasswordSchema,
  verifyForgotOtpSchema,
  resetPasswordSchema,
  refreshTokenSchema,
} from './auth.validator';

const router = Router();

// ─── Signup Flow (3-step) ────────────────────────────────────────────────────
// Step 1: Send 4-digit OTP to email
router.post(
  '/initiate-signup',
  authOtpRateLimiter,
  validate(initiateSignupSchema),
  AuthController.initiateSignup
);

// Step 2: Verify OTP → get registrationToken
router.post(
  '/verify-signup-otp',
  authOtpRateLimiter,
  validate(verifySignupOtpSchema),
  AuthController.verifySignupOtp
);

// Step 3: Complete signup → get JWT tokens
router.post(
  '/complete-signup',
  authSigninRateLimiter,
  validate(completeSignupSchema),
  AuthController.completeSignup
);

// ─── Direct Signup & Login ───────────────────────────────────────────────────
router.post(
  '/signup',
  authSigninRateLimiter,
  validate(signupDirectSchema),
  AuthController.directSignup
);

router.post(
  '/register',
  authSigninRateLimiter,
  validate(signupDirectSchema),
  AuthController.directSignup
);

// ─── Sign In ─────────────────────────────────────────────────────────────────
router.post(
  '/signin',
  authSigninRateLimiter,
  validate(signinSchema),
  AuthController.signin
);

router.post(
  '/login',
  authSigninRateLimiter,
  validate(signinSchema),
  AuthController.signin
);

// ─── Token Management ─────────────────────────────────────────────────────────
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  AuthController.refreshTokens
);

router.post(
  '/logout',
  authenticate,
  AuthController.logout
);

// ─── Forgot Password Flow (3-step) ───────────────────────────────────────────
// Step 1: Send 4-digit reset OTP
router.post(
  '/forgot-password',
  authOtpRateLimiter,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword
);

// Step 2: Verify OTP → get resetToken
router.post(
  '/verify-forgot-otp',
  authOtpRateLimiter,
  validate(verifyForgotOtpSchema),
  AuthController.verifyForgotOtp
);

// Step 3: Reset password with resetToken
router.post(
  '/reset-password',
  authResetRateLimiter,
  validate(resetPasswordSchema),
  AuthController.resetPassword
);

// ─── Protected ───────────────────────────────────────────────────────────────
router.get('/me', authenticate, AuthController.getMe);

export default router;
