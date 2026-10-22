import { Request, Response } from 'express';
import { VerificationService } from '../services/verification.service';
import { ApiResponse } from '../utils/response.util';

export class VerificationController {
  static async apply(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
      }

      const { organizationName, category, organizationEmail, phone, website } = req.body;
      if (!organizationName || !category || !organizationEmail || !phone) {
        return ApiResponse.error(res, 'Missing required organization details', 400, 'VALIDATION_ERROR');
      }

      const result = await VerificationService.applyForVerification(userId, {
        organizationName,
        category,
        organizationEmail,
        phone,
        website,
      });

      return ApiResponse.created(res, result, 'Verification application submitted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async myStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
      }

      const result = await VerificationService.getMyVerificationStatus(userId);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async completeCategory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
      }

      const result = await VerificationService.completeCategoryAsUser(userId);
      return ApiResponse.success(res, result, 'Category selection completed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
