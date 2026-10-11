import { Router } from 'express';
import { SupportController } from '../controllers/support.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createTicketSchema, updateTicketStatusSchema } from '../validations/support.validation.js';

const router = Router();

router.post('/tickets', requireAuth, validateRequest(createTicketSchema), SupportController.createTicket);
router.get('/my-tickets', requireAuth, SupportController.getMyTickets);
router.patch('/tickets/:ticketId', requireAuth, requireRole('admin'), validateRequest(updateTicketStatusSchema), SupportController.updateTicketStatus);

export default router;
