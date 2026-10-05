import { Request, Response } from 'express';
import { EventService } from '../services/event.service';
import { ApiResponse } from '../utils/response.util';

export class EventController {
  static async createEvent(req: Request, res: Response) {
    try {
      const orgId = req.body.orgId || req.user?.orgId || req.user?.id;
      const event = await EventService.createEvent(orgId, req.user!.id, req.body);
      return ApiResponse.created(res, event);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async listEvents(req: Request, res: Response) {
    try {
      const result = await EventService.listEvents(req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getEventById(req: Request, res: Response) {
    try {
      const event = await EventService.getEventById(req.params.id);
      if (!event) return ApiResponse.error(res, 'Event not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, event);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateEvent(req: Request, res: Response) {
    try {
      const updated = await EventService.updateEvent(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'Event updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async deleteEvent(req: Request, res: Response) {
    try {
      await EventService.deleteEvent(req.params.id);
      return ApiResponse.success(res, { deleted: true }, 'Event deleted');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async saveEvent(req: Request, res: Response) {
    try {
      const result = await EventService.saveEvent(req.user!.id, req.params.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async unsaveEvent(req: Request, res: Response) {
    try {
      const result = await EventService.unsaveEvent(req.user!.id, req.params.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getSimilarEvents(req: Request, res: Response) {
    try {
      const similar = await EventService.getSimilarEvents(req.params.id);
      return ApiResponse.success(res, similar);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
