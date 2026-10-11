import { z } from 'zod';

export const triggerSosSchema = z.object({
  rideId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().optional()
});

export const resolveSosSchema = z.object({
  alertId: z.string().uuid(),
  notes: z.string().optional()
});
