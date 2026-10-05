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

  static async logout(req: Request, res: Response) {
    return ApiResponse.success(res, { loggedOut: true }, 'Successfully logged out');
  }
}
