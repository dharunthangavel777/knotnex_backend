import { Request, Response } from 'express';
import { TicketService } from '../services/ticket.service';
import { ApiResponse } from '../utils/response.util';
import { UserRole } from '../types/enums';

export class TicketController {
  static async createTicket(req: Request, res: Response) {
    try {
      const ticket = await TicketService.createTicket(req.user!.id, req.body);
      return ApiResponse.created(res, ticket);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async listTickets(req: Request, res: Response) {
    try {
      const queryParams: any = { ...req.query };
      // If user is not admin, scope to their own tickets or their org tickets
      if (req.user?.role === UserRole.USER) {
        queryParams.userId = req.user.id;
      } else if (req.user?.role === UserRole.ORGANIZATION) {
        queryParams.orgId = req.user.orgId;
      }

      const result = await TicketService.listTickets(queryParams);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getTicketById(req: Request, res: Response) {
    try {
      const ticket = await TicketService.getTicketById(req.params.id);
      if (!ticket) return ApiResponse.error(res, 'Ticket not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, ticket);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const updated = await TicketService.updateStatus(req.params.id, req.body.status);
      return ApiResponse.success(res, updated, 'Ticket status updated');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async assignTicket(req: Request, res: Response) {
    try {
      const updated = await TicketService.assignTicket(req.params.id, req.body.assignedTo);
      return ApiResponse.success(res, updated, 'Ticket assigned');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  static async addReply(req: Request, res: Response) {
    try {
      const reply = await TicketService.addReply(req.params.id, req.user!.id, req.body);
      return ApiResponse.created(res, reply, 'Reply added');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }
}
