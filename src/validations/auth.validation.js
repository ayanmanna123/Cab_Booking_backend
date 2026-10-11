import { z } from 'zod';

export const syncUserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: z.string().email('Valid email is required').or(z.string()).optional().nullable(),
  fullName: z.string().optional().nullable().default('Uber User'),
  phone: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  role: z.enum(['rider', 'driver', 'admin']).default('rider')
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional()
});
