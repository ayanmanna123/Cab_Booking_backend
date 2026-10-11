import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  rideId: z.string().uuid('Valid ride UUID is required'),
  paymentMethod: z.enum(['card', 'stripe', 'cash', 'wallet']).default('stripe')
});

export const confirmPaymentSchema = z.object({
  rideId: z.string().uuid('Valid ride UUID is required'),
  paymentIntentId: z.string().min(5, 'Stripe Payment Intent ID is required')
});
