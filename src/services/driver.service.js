import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { DB_TABLES } from '../config/constants.js';
import { calculateHaversineDistance, findNearbyDrivers } from '../utils/geoUtils.js';
import { logger } from '../utils/logger.js';

const memoryDrivers = new Map();

export class DriverService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async registerDriver(userId, driverData) {
    const client = this.getClient();

    const vehicleTierMap = {
      'uberx': 'economy',
      'uber comfort': 'comfort',
      'uberxl': 'xl',
      'uber black': 'black',
      'economy': 'economy',
      'comfort': 'comfort',
      'xl': 'xl',
      'black': 'black'
    };
    const vehicleTypeId = vehicleTierMap[(driverData.vehicleTypeId || 'economy').toLowerCase()] || 'economy';

    const payload = {
      user_id: userId,
      vehicle_type_id: vehicleTypeId,
      vehicle_make: driverData.vehicleMake || 'Toyota',
      vehicle_model: driverData.vehicleModel || 'Camry',
      vehicle_year: Number(driverData.vehicleYear) || new Date().getFullYear(),
      license_plate: driverData.licensePlate,
      vehicle_color: driverData.vehicleColor || 'Silver',
      is_online: false,
      is_available: true,
      current_latitude: driverData.currentLatitude || 37.7749,
      current_longitude: driverData.currentLongitude || -122.4194,
      stripe_account_id: driverData.aadhaarNumber ? `AADHAAR:${driverData.aadhaarNumber}` : null,
      updated_at: new Date().toISOString()
    };

    if (client) {
      // 1. Ensure user exists and update profile in cb_users
      const { data: existingUser } = await client
        .from(DB_TABLES.USERS)
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const userUpdatePayload = {
        id: userId,
        full_name: driverData.fullName || existingUser?.full_name || 'Uber Driver',
        phone: driverData.phone || existingUser?.phone || null,
        avatar_url: driverData.carImageUrl || existingUser?.avatar_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400',
        role: 'driver',
        emergency_contact_name: driverData.emergencyContactName || existingUser?.emergency_contact_name || null,
        emergency_contact_phone: driverData.emergencyContactPhone || existingUser?.emergency_contact_phone || null,
        email: existingUser?.email || driverData.email || `${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}@uberclone.local`,
        updated_at: new Date().toISOString()
      };

      await client
        .from(DB_TABLES.USERS)
        .upsert(userUpdatePayload, { onConflict: 'id' });

      // 2. Upsert driver profile in cb_driver_profiles
      const { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .upsert(payload, { onConflict: 'user_id' })
        .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
        .single();

      if (error) {
        logger.error('Error registering driver in Supabase:', error);
        throw new Error(error.message);
      }

      // Merge extra client metadata for seamless frontend state
      return {
        ...data,
        aadhaar_number: driverData.aadhaarNumber,
        driving_license: driverData.drivingLicense,
        car_image_url: driverData.carImageUrl,
        license_image_url: driverData.licenseImageUrl,
        payout_method: driverData.payoutMethod,
        upi_id: driverData.upiId
      };
    }

    const driverId = crypto.randomUUID();
    const saved = {
      id: driverId,
      ...payload,
      rating: 5.0,
      total_rides: 0,
      total_earnings: 0.0,
      aadhaar_number: driverData.aadhaarNumber,
      driving_license: driverData.drivingLicense,
      car_image_url: driverData.carImageUrl,
      created_at: new Date().toISOString()
    };
    memoryDrivers.set(driverId, saved);
    memoryDrivers.set(`user_${userId}`, saved);
    return saved;
  }

  static async getDriverByUserId(userId) {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    }
    return memoryDrivers.get(`user_${userId}`) || null;
  }

  static async getDriverById(driverId) {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
        .eq('id', driverId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    }
    return memoryDrivers.get(driverId) || null;
  }

  static async updateLocation(driverId, { latitude, longitude, heading = 0 }) {
    const client = this.getClient();
    const update = {
      current_latitude: latitude,
      current_longitude: longitude,
      heading,
      last_location_updated_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .update(update)
        .eq('id', driverId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    const driver = memoryDrivers.get(driverId);
    if (driver) {
      Object.assign(driver, update);
      return driver;
    }
    return null;
  }

  static async toggleOnlineStatus(driverId, isOnline) {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .update({ is_online: isOnline, updated_at: new Date().toISOString() })
        .eq('id', driverId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    const driver = memoryDrivers.get(driverId);
    if (driver) {
      driver.is_online = isOnline;
      return driver;
    }
    return null;
  }

  static async getNearbyDrivers({ latitude, longitude, vehicleType, radiusKm = 10 }) {
    const client = this.getClient();
    let drivers = [];

    if (client) {
      let query = client
        .from(DB_TABLES.DRIVER_PROFILES)
        .select(`*, ${DB_TABLES.USERS}(full_name, avatar_url, phone), ${DB_TABLES.VEHICLE_TYPES}(*)`)
        .eq('is_online', true)
        .eq('is_available', true);

      if (vehicleType) {
        query = query.eq('vehicle_type_id', vehicleType);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      drivers = data || [];
    } else {
      drivers = Array.from(memoryDrivers.values()).filter(
        (d) => d.id && d.is_online && d.is_available && (!vehicleType || d.vehicle_type_id === vehicleType)
      );
    }

    return findNearbyDrivers(drivers, latitude, longitude, radiusKm);
  }

  static async getDriverDashboard(driverId) {
    const driver = await this.getDriverById(driverId);
    if (!driver) throw new Error('Driver profile not found');

    const client = this.getClient();
    let recentRides = [];
    if (client) {
      const { data } = await client
        .from(DB_TABLES.RIDES)
        .select(`*, ${DB_TABLES.USERS}!cb_rides_rider_id_fkey(full_name, avatar_url)`)
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(10);
      recentRides = data || [];
    }

    return {
      driverProfile: driver,
      stats: {
        totalRides: driver.total_rides || 0,
        rating: driver.rating || 5.0,
        totalEarnings: driver.total_earnings || 0.0,
        isOnline: driver.is_online,
        isAvailable: driver.is_available
      },
      recentRides
    };
  }
}
