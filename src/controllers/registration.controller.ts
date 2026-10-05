import { Request, Response } from 'express';
import { RegistrationService } from '../services/registration.service';
import { ApiResponse } from '../utils/response.util';

export class RegistrationController {
  static async register(req: Request, res: Response) {
    try {
      const registration = await RegistrationService.registerForEvent(req.user!.id, req.body);
      return ApiResponse.created(res, registration, 'Registered successfully');
    } catch (error: any) {
      const status = error.message?.includes('already registered') ? 409 : 400;
      return ApiResponse.error(res, error.message, status);
    }
  }

  static async listByEvent(req: Request, res: Response) {
    try {
      const registrants = await RegistrationService.listRegistrationsByEvent(req.params.eventId);
      return ApiResponse.success(res, registrants);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async listByUser(req: Request, res: Response) {
    try {
      const myEvents = await RegistrationService.listRegistrationsByUser(req.params.userId || req.user!.id);
      return ApiResponse.success(res, myEvents);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const registration = await RegistrationService.getRegistrationById(req.params.id);
      if (!registration) return ApiResponse.error(res, 'Registration not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, registration);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const updated = await RegistrationService.updateStatus(req.params.id, req.body.status);
      return ApiResponse.success(res, updated);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async checkInByQr(req: Request, res: Response) {
    try {
      const result = await RegistrationService.checkInByQr(req.body.qrCodeHash);
      return ApiResponse.success(res, result, 'Check-in verified successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async getQrPass(req: Request, res: Response) {
    try {
      const pass = await RegistrationService.getQrPass(req.params.id, req.user!.id);
      if (!pass) return ApiResponse.error(res, 'Pass not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, pass);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
