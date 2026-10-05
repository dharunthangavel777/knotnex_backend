import { Request, Response } from 'express';
import { JobService } from '../services/job.service';
import { ApiResponse } from '../utils/response.util';

export class JobController {
  static async createJob(req: Request, res: Response) {
    try {
      const orgId = req.body.orgId || req.user?.orgId || req.user?.id;
      const job = await JobService.createJob(orgId, req.user!.id, req.body);
      return ApiResponse.created(res, job);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async listJobs(req: Request, res: Response) {
    try {
      const result = await JobService.listJobs(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getJobById(req: Request, res: Response) {
    try {
      const job = await JobService.getJobById(req.params.id);
      if (!job) return ApiResponse.error(res, 'Job not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, job);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateJob(req: Request, res: Response) {
    try {
      const updated = await JobService.updateJob(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'Job updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async deleteJob(req: Request, res: Response) {
    try {
      await JobService.deleteJob(req.params.id);
      return ApiResponse.success(res, { deleted: true }, 'Job deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async saveJob(req: Request, res: Response) {
    try {
      const result = await JobService.saveJob(req.user!.id, req.params.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getSimilarJobs(req: Request, res: Response) {
    try {
      const similar = await JobService.getSimilarJobs(req.params.id);
      return ApiResponse.success(res, similar);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
