import { z } from 'zod';

const coordinateSchema = z.number().min(-180).max(180);

const stopSchema = z.object({
  address: z.string().min(1),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
  stopOrder: z.number().int().min(1)
});

export const estimateFareSchema = z.object({
  pickupLatitude: coordinateSchema,
  pickupLongitude: coordinateSchema,
  dropoffLatitude: coordinateSchema,
  dropoffLongitude: coordinateSchema,
  stops: z.array(stopSchema).optional().default([]),
  promoCode: z.string().optional()
});

export const requestRideSchema = z.object({
  pickupAddress: z.string().min(3, 'Pickup address is required'),
  pickupLatitude: coordinateSchema,
  pickupLongitude: coordinateSchema,
  dropoffAddress: z.string().min(3, 'Dropoff address is required'),
  dropoffLatitude: coordinateSchema,
  dropoffLongitude: coordinateSchema,
  vehicleType: z.enum(['economy', 'comfort', 'xl', 'black']).default('economy'),
  stops: z.array(stopSchema).optional().default([]),
  promoCode: z.string().optional()
});

export const updateRideStatusSchema = z.object({
  status: z.enum([
    'REQUESTED',
    'SEARCHING',
    'ACCEPTED',
    'ARRIVING',
    'ARRIVED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  ]),
  otp: z.string().length(4).or(z.string().length(6)).optional()
});

export const cancelRideSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required')
});
