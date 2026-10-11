import { z } from 'zod';

export const registerDriverSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  aadhaarNumber: z.string().optional().transform(v => v ? v.replace(/\s/g, '') : ''),
  drivingLicense: z.string().optional(),
  vehicleTypeId: z.enum(['economy', 'comfort', 'xl', 'black']).or(z.string().transform(v => {
    const map = { 'uberx': 'economy', 'uber comfort': 'comfort', 'uberxl': 'xl', 'uber black': 'black' };
    return map[v.toLowerCase()] || 'economy';
  })).optional().default('economy'),
  vehicleMake: z.string().optional().default('Toyota'),
  vehicleModel: z.string().optional().default('Camry'),
  vehicleYear: z.coerce.number().optional().default(new Date().getFullYear()),
  licensePlate: z.string().optional().default('DL-01-PLATE'),
  vehicleColor: z.string().optional().default('Silver'),
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
