import { z } from 'zod';

export const createReviewSchema = z.object({
  rideId: z.string().uuid('Valid ride UUID is required'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5 stars'),
  comment: z.string().max(1000).optional()
});
