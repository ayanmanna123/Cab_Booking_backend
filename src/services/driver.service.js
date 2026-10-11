import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { calculateHaversineDistance, findNearbyDrivers } from '../utils/geoUtils.js';
import { logger } from '../utils/logger.js';

const memoryDrivers = new Map();

export class DriverService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async registerDriver(userId, driverData) {
    const client = this.getClient();
    const payload = {
      user_id: userId,
      vehicle_type_id: driverData.vehicleTypeId,
      vehicle_make: driverData.vehicleMake,
      vehicle_model: driverData.vehicleModel,
      vehicle_year: driverData.vehicleYear,
      license_plate: driverData.licensePlate,
      vehicle_color: driverData.vehicleColor,
      is_online: false,
      is_available: true,
      current_latitude: driverData.currentLatitude || 37.7749,
      current_longitude: driverData.currentLongitude || -122.4194,
      updated_at: new Date().toISOString()
    };

    if (client) {
      // First ensure the user role is updated to 'driver'
      await client.from('users').update({ role: 'driver' }).eq('id', userId);

      const { data, error } = await client
        .from('driver_profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*, users(full_name, email, phone, avatar_url), vehicle_types(*)')
        .single();

      if (error) {
        logger.error('Error registering driver in Supabase:', error);
        throw new Error(error.message);
      }
      return data;
    }

    const driverId = crypto.randomUUID();
    const saved = {
      id: driverId,
      ...payload,
      rating: 5.0,
      total_rides: 0,
      total_earnings: 0.0,
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
        .from('driver_profiles')
        .select('*, users(full_name, email, phone, avatar_url), vehicle_types(*)')
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
        .from('driver_profiles')
        .select('*, users(full_name, email, phone, avatar_url), vehicle_types(*)')
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
        .from('driver_profiles')
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
        .from('driver_profiles')
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
        .from('driver_profiles')
        .select('*, users(full_name, avatar_url, phone), vehicle_types(*)')
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
        .from('rides')
        .select('*, users!rides_rider_id_fkey(full_name, avatar_url)')
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
