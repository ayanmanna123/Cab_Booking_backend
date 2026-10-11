import { SupportService } from '../services/support.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class SupportController {
  static async createTicket(req, res, next) {
    try {
      const ticket = await SupportService.createTicket(req.user.id, req.body);
      return ApiResponse.created(res, ticket, 'Support ticket created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getMyTickets(req, res, next) {
    try {
      const tickets = await SupportService.getUserTickets(req.user.id);
      return ApiResponse.success(res, tickets, 'User support tickets fetched');
    } catch (err) {
      next(err);
    }
  }

  static async updateTicketStatus(req, res, next) {
    try {
      const { ticketId } = req.params;
      const { status, adminNotes } = req.body;
      const updated = await SupportService.updateTicketStatus(ticketId, status, adminNotes);
      return ApiResponse.success(res, updated, 'Ticket status updated');
    } catch (err) {
      next(err);
    }
  }
}
