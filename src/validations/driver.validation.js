import { z } from 'zod';

export const registerDriverSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').optional(),
  phone: z.string().min(8, 'Valid mobile number is required').optional(),
  email: z.string().email().optional(),
  aadhaarNumber: z.string().min(12, '12-digit Aadhaar Card number is required').optional(),
  drivingLicense: z.string().min(5, 'Valid Driving License number is required').optional(),
  vehicleTypeId: z.enum(['economy', 'comfort', 'xl', 'black']).or(z.string().transform(v => {
    const map = { 'uberx': 'economy', 'uber comfort': 'comfort', 'uberxl': 'xl', 'uber black': 'black' };
    return map[v.toLowerCase()] || v;
  })),
  vehicleMake: z.string().min(2, 'Vehicle make is required'),
  vehicleModel: z.string().min(2, 'Vehicle model is required'),
  vehicleYear: z.coerce.number().int().min(1995).max(new Date().getFullYear() + 1),
  licensePlate: z.string().min(3, 'License plate is required'),
  vehicleColor: z.string().min(2, 'Vehicle color is required'),
  carImageUrl: z.string().optional(),
  licenseImageUrl: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  payoutMethod: z.string().optional(),
  upiId: z.string().optional()
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
