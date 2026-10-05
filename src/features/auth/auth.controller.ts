import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../utils/response.util';
import { logger } from '../../config/logger';

export class AuthController {

  // POST /auth/initiate-signup
  static async initiateSignup(req: Request, res: Response) {
    try {
      const result = await AuthService.initiateSignup(req.body);
      return ApiResponse.success(res, result, result.message);
    } catch (error: any) {
      logger.warn('[AuthController] initiateSignup error', { error: error.message });
      return ApiResponse.error(res, error.message, 400, 'SIGNUP_INITIATE_FAILED');
    }
  }

  // POST /auth/verify-signup-otp
  static async verifySignupOtp(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;
      const result = await AuthService.verifySignupOtp(email, otp);
      return ApiResponse.success(res, result, result.message);
    } catch (error: any) {
      logger.warn('[AuthController] verifySignupOtp error', { error: error.message });
      return ApiResponse.error(res, error.message, 400, 'OTP_VERIFICATION_FAILED');
    }
  }

  // POST /auth/complete-signup
  static async completeSignup(req: Request, res: Response) {
    try {
      const { registrationToken, firebaseIdToken, password, fullName, full_name, phone } = req.body;
      const result = await AuthService.completeSignup(
        registrationToken,
        firebaseIdToken,
        password,
        fullName || full_name,
        phone
      );
      return ApiResponse.created(res, result, 'Account created successfully. Welcome to Knotnex!');
    } catch (error: any) {
      logger.warn('[AuthController] completeSignup error', { error: error.message });
      return ApiResponse.error(res, error.message, 400, 'SIGNUP_FAILED');
    }
  }

  // POST /auth/signin & POST /auth/login
  static async signin(req: Request, res: Response) {
    try {
      const { firebaseIdToken, email, password } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || '';
      const userAgent = req.headers['user-agent'] || '';

      const result = await AuthService.signin({ firebaseIdToken, email, password });

      // Register device info asynchronously (non-blocking)
      if (result.user.id) {
        AuthService.registerLoginDevice(result.user.id, {
          ipAddress,
          browser: userAgent,
          deviceType: 'mobile',
        }).catch(() => {});
      }

      return ApiResponse.success(res, result, 'Signed in successfully.');
    } catch (error: any) {
      logger.warn('[AuthController] signin error', { error: error.message });
      return ApiResponse.error(res, error.message, 401, 'SIGNIN_FAILED');
    }
  }

  // POST /auth/signup & POST /auth/register
  static async directSignup(req: Request, res: Response) {
    try {
      const { email, password, fullName, full_name, phone, role } = req.body;
      const result = await AuthService.directSignup({
        email,
        password,
        fullName: fullName || full_name,
        phone,
        role,
      });
      return ApiResponse.created(res, result, 'Account created successfully.');
    } catch (error: any) {
      logger.warn('[AuthController] directSignup error', { error: error.message });
      const status = error.message?.includes('already exists') ? 409 : 400;
      return ApiResponse.error(res, error.message, status, status === 409 ? 'USER_ALREADY_EXISTS' : 'SIGNUP_FAILED');
    }
  }

  // POST /auth/refresh
  static async refreshTokens(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refreshTokens(refreshToken);
      return ApiResponse.success(res, result, 'Tokens refreshed successfully.');
    } catch (error: any) {
      logger.warn('[AuthController] refreshTokens error', { error: error.message });
      return ApiResponse.error(res, error.message, 401, 'TOKEN_REFRESH_FAILED');
    }
  }

  // POST /auth/logout
  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);
      return ApiResponse.success(res, { loggedOut: true }, 'Logged out successfully.');
    } catch (error: any) {
      // Even if logout fails, respond with success (idempotent)
      return ApiResponse.success(res, { loggedOut: true }, 'Logged out successfully.');
    }
  }

  // POST /auth/forgot-password
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);
      return ApiResponse.success(res, result, result.message);
    } catch (error: any) {
      logger.warn('[AuthController] forgotPassword error', { error: error.message });
      return ApiResponse.error(res, error.message, 400, 'FORGOT_PASSWORD_FAILED');
    }
  }

  // POST /auth/verify-forgot-otp
  static async verifyForgotOtp(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;
      const result = await AuthService.verifyForgotOtp(email, otp);
      return ApiResponse.success(res, result, result.message);
    } catch (error: any) {
      logger.warn('[AuthController] verifyForgotOtp error', { error: error.message });
      return ApiResponse.error(res, error.message, 400, 'OTP_VERIFICATION_FAILED');
    }
  }

  // POST /auth/reset-password
  static async resetPassword(req: Request, res: Response) {
    try {
      const { resetToken, newPassword } = req.body;
      const result = await AuthService.resetPassword(resetToken, newPassword);
      return ApiResponse.success(res, result, result.message);
    } catch (error: any) {
      logger.warn('[AuthController] resetPassword error', { error: error.message });
      return ApiResponse.error(res, error.message, 400, 'PASSWORD_RESET_FAILED');
    }
  }

  // GET /auth/me
  static async getMe(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const user = await AuthService.getMe(userId);
      return ApiResponse.success(res, { user }, 'User profile fetched.');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 404, 'USER_NOT_FOUND');
    }
  }
}
