import { z } from 'zod';

export const createTicketSchema = z.object({
  rideId: z.string().uuid().optional(),
  category: z.enum(['PAYMENT_ISSUE', 'LOST_ITEM', 'DRIVER_BEHAVIOR', 'APP_BUG', 'OTHER']),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']),
  adminNotes: z.string().optional()
});
