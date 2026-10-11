import { z } from 'zod';

export const registerDriverSchema = z.object({
  vehicleTypeId: z.enum(['economy', 'comfort', 'xl', 'black']),
  vehicleMake: z.string().min(2, 'Vehicle make is required'),
  vehicleModel: z.string().min(2, 'Vehicle model is required'),
  vehicleYear: z.number().int().min(2005).max(new Date().getFullYear() + 1),
  licensePlate: z.string().min(3, 'License plate is required'),
  vehicleColor: z.string().min(2, 'Vehicle color is required')
});

export const updateDriverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional().default(0)
});

export const toggleDriverStatusSchema = z.object({
  isOnline: z.boolean()
});

export const getNearbyDriversSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  vehicleType: z.enum(['economy', 'comfort', 'xl', 'black']).optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional().default(10)
});
