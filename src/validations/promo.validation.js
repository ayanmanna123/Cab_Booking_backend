import { z } from 'zod';

export const validatePromoSchema = z.object({
  code: z.string().min(2, 'Promo code is required').trim().toUpperCase(),
  rideFare: z.coerce.number().positive('Fare must be greater than zero')
});

export const createPromoSchema = z.object({
  code: z.string().min(2).trim().toUpperCase(),
  description: z.string().optional(),
  discountPercentage: z.number().min(1).max(100),
  maxDiscountAmount: z.number().positive().default(20),
  minRideFare: z.number().nonnegative().default(10),
  validUntil: z.string().datetime(),
  usageLimit: z.number().int().positive().default(1000)
});
