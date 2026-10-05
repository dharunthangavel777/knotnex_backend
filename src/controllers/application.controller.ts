import { Request, Response } from 'express';
import { ApplicationService } from '../services/application.service';
import { ApiResponse } from '../utils/response.util';

export class ApplicationController {
  static async submit(req: Request, res: Response) {
    try {
      const application = await ApplicationService.submitApplication(req.user!.id, req.body);
      return ApiResponse.created(res, application, 'Application submitted');
    } catch (error: any) {
      const status = error.message?.includes('already applied') ? 409 : 400;
      return ApiResponse.error(res, error.message, status);
    }
  }

  static async listByJob(req: Request, res: Response) {
    try {
      const applications = await ApplicationService.listApplicationsByJob(req.params.jobId);
      return ApiResponse.success(res, applications);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async listByUser(req: Request, res: Response) {
    try {
      const applications = await ApplicationService.listApplicationsByUser(req.params.userId || req.user!.id);
      return ApiResponse.success(res, applications);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const application = await ApplicationService.getApplicationById(req.params.id);
      if (!application) return ApiResponse.error(res, 'Application not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, application);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateStage(req: Request, res: Response) {
    try {
      const updated = await ApplicationService.updateStage(req.params.id, req.body.stage, req.body.reviewerNotes);
      return ApiResponse.success(res, updated, 'Stage updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }
}
