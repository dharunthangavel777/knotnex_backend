import { Request, Response } from 'express';
import { SchemeService } from '../services/scheme.service';
import { ApiResponse } from '../utils/response.util';

export class SchemeController {
  static async createScheme(req: Request, res: Response) {
    try {
      const orgId = req.body.orgId || req.user?.orgId || null;
      const scheme = await SchemeService.createScheme(orgId, req.user!.id, req.body);
      return ApiResponse.created(res, scheme);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async listSchemes(req: Request, res: Response) {
    try {
      const result = await SchemeService.listSchemes(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getSchemeById(req: Request, res: Response) {
    try {
      const scheme = await SchemeService.getSchemeById(req.params.id);
      if (!scheme) return ApiResponse.error(res, 'Scheme not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, scheme);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateScheme(req: Request, res: Response) {
    try {
      const updated = await SchemeService.updateScheme(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'Scheme updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async deleteScheme(req: Request, res: Response) {
    try {
      await SchemeService.deleteScheme(req.params.id);
      return ApiResponse.success(res, { deleted: true }, 'Scheme deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async applyForScheme(req: Request, res: Response) {
    try {
      const application = await SchemeService.applyForScheme(req.params.id, req.user!.id, req.body);
      return ApiResponse.created(res, application, 'Scheme application submitted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async listApplications(req: Request, res: Response) {
    try {
      const applications = await SchemeService.listApplications(req.params.id);
      return ApiResponse.success(res, applications);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getApplicationById(req: Request, res: Response) {
    try {
      const app = await SchemeService.getApplicationById(req.params.appId || req.params.id);
      if (!app) return ApiResponse.error(res, 'Application not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, app);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateApplicationStatus(req: Request, res: Response) {
    try {
      const appId = req.params.appId || req.params.id;
      const { status, stage, reviewerNotes } = req.body;
      const updated = await SchemeService.updateApplicationStatus(appId, status, stage, reviewerNotes);
      return ApiResponse.success(res, updated, 'Application status updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getOrgSchemeApplications(req: Request, res: Response) {
    try {
      const orgId = req.params.orgId || req.params.id || req.user?.orgId;
      if (!orgId) return ApiResponse.error(res, 'Organization ID is required', 400);
      const applications = await SchemeService.getOrgSchemeApplications(orgId);
      return ApiResponse.success(res, applications);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async saveScheme(req: Request, res: Response) {
    try {
      const result = await SchemeService.saveScheme(req.user!.id, req.params.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async unsaveScheme(req: Request, res: Response) {
    try {
      const result = await SchemeService.unsaveScheme(req.user!.id, req.params.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
