import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/response.util';

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const user = await AuthService.signup(req.body);
      return ApiResponse.created(res, user, 'Account created successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400, 'SIGNUP_FAILED');
    }
  }

  static async sendOtp(req: Request, res: Response) {
    try {
      const result = await AuthService.sendOtp(req.body.phone);
      return ApiResponse.success(res, result, 'OTP sent successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400, 'SEND_OTP_FAILED');
    }
  }

  static async verifyOtp(req: Request, res: Response) {
    try {
      const result = await AuthService.verifyOtp(req.body.phone, req.body.code);
      return ApiResponse.success(res, result, 'OTP verified');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400, 'VERIFY_OTP_FAILED');
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const result = await AuthService.forgotPassword(req.body.email);
      return ApiResponse.success(res, result, 'Reset email sent');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400, 'PASSWORD_RESET_FAILED');
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return ApiResponse.error(res, 'Email and password are required', 400, 'VALIDATION_ERROR');
      }

      // Admin portal authentication
      if (email.toLowerCase().trim() === 'admin@knotnex.com' && password === 'admin123') {
        return ApiResponse.success(
          res,
          {
            token: 'mock_admin',
            user: {
              id: '00000000-0000-0000-0000-000000000001',
              email: 'admin@knotnex.com',
              fullName: 'Master Administrator',
              role: 'admin',
            },
          },
          'Admin authenticated successfully'
        );
      }

      return ApiResponse.error(res, 'Invalid admin email or password', 401, 'INVALID_CREDENTIALS');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500, 'LOGIN_FAILED');
    }
  }

  static async logout(req: Request, res: Response) {
    return ApiResponse.success(res, { loggedOut: true }, 'Successfully logged out');
  }
}
