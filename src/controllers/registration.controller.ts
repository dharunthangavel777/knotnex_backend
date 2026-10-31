import { Request, Response } from 'express';
import { RegistrationService } from '../services/registration.service';
import { OrganizationService } from '../services/organization.service';
import { ApiResponse } from '../utils/response.util';

export class RegistrationController {
  static async listAll(req: Request, res: Response) {
    try {
      const orgId = (req.query.org_id || req.query.orgId || req.user?.orgId) as string;
      const eventId = req.query.eventId as string;
      if (eventId) {
        const registrants = await RegistrationService.listRegistrationsByEvent(eventId);
        return ApiResponse.success(res, registrants);
      }
      if (orgId) {
        const result = await OrganizationService.getOrgRegistrations(orgId, req.query);
        return ApiResponse.paginated(res, result);
      }
      const myEvents = await RegistrationService.listRegistrationsByUser(req.user!.id);
      return ApiResponse.success(res, myEvents);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

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

  static async checkInById(req: Request, res: Response) {
    try {
      const result = await RegistrationService.checkInById(req.params.id);
      return ApiResponse.success(res, result, 'Check-in verified successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async cancel(req: Request, res: Response) {
    try {
      const result = await RegistrationService.cancelRegistration(req.params.id, req.user!.id);
      return ApiResponse.success(res, result, 'Registration cancelled');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
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
  static async createOrder(req: Request, res: Response) {
    try {
      const { eventId, tier } = req.body;
      if (!eventId) return ApiResponse.error(res, 'eventId is required', 400);
      const order = await RegistrationService.createPaymentOrder(req.user!.id, eventId, tier);
      return ApiResponse.success(res, order, 'Payment order generated successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async verifyPayment(req: Request, res: Response) {
    try {
      const { eventId, orderId, paymentId, signature, personalInfo, accessibilityNeeds, consentGiven } = req.body;
      if (!eventId || !orderId || !paymentId) {
        return ApiResponse.error(res, 'eventId, orderId, and paymentId are required', 400);
      }
      const registration = await RegistrationService.verifyAndRegisterPaidEvent(req.user!.id, {
        eventId,
        orderId,
        paymentId,
        signature,
        personalInfo,
        accessibilityNeeds,
        consentGiven,
      });
      return ApiResponse.created(res, registration, 'Payment verified and ticket pass issued');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async handleWebhook(req: Request, res: Response) {
    try {
      const event = req.body?.event || 'payment.captured';
      return ApiResponse.success(res, { received: true, event }, 'Webhook acknowledged');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
