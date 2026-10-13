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

    let effectiveUserId = userId;

    if (client) {
      // 1. Resolve user in cb_users by ID or by email to ensure valid foreign key
      let existingUser = null;
      if (effectiveUserId && effectiveUserId !== 'driver_partner_official') {
        const { data: userById } = await client
          .from(DB_TABLES.USERS)
          .select('*')
          .eq('id', effectiveUserId)
          .maybeSingle();
        if (userById) existingUser = userById;
      }

      // Fallback check by email if user not found by ID
      if (!existingUser && driverData.email) {
        const { data: userByEmail } = await client
          .from(DB_TABLES.USERS)
          .select('*')
          .eq('email', driverData.email)
          .maybeSingle();
        if (userByEmail) {
          existingUser = userByEmail;
          effectiveUserId = userByEmail.id;
        }
      }

      // If still no user exists, provision one with effectiveUserId
      if (!existingUser) {
        effectiveUserId = effectiveUserId && effectiveUserId !== 'driver_partner_official'
          ? effectiveUserId
          : `driver_${Date.now()}`;
      }

      const userUpdatePayload = {
        id: effectiveUserId,
        full_name: driverData.fullName || driverData.full_name || existingUser?.full_name || 'Uber Driver',
        phone: driverData.phone || existingUser?.phone || null,
        avatar_url: driverData.carImageUrl || driverData.car_image_url || existingUser?.avatar_url || 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/HatchbackMini-Snowflake-520.png',
        role: 'driver',
        emergency_contact_name: driverData.emergencyContactName || existingUser?.emergency_contact_name || null,
        emergency_contact_phone: driverData.emergencyContactPhone || existingUser?.emergency_contact_phone || null,
        email: existingUser?.email || driverData.email || `${effectiveUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}@uberclone.local`,
        updated_at: new Date().toISOString()
      };

      const { error: userUpsertErr } = await client
        .from(DB_TABLES.USERS)
        .upsert(userUpdatePayload, { onConflict: 'id' });

      if (userUpsertErr) {
        logger.warn('User upsert notice in cb_users:', userUpsertErr.message);
      }

      const upiIdClean = (driverData.upiId || driverData.upi_id || '').trim();
      const aadhaarClean = (driverData.aadhaarNumber || driverData.aadhaar_number || '').trim();
      let stripeAccountId = null;
      if (upiIdClean && aadhaarClean) {
        stripeAccountId = `UPI:${upiIdClean}|AADHAAR:${aadhaarClean}`;
      } else if (upiIdClean) {
        stripeAccountId = `UPI:${upiIdClean}`;
      } else if (aadhaarClean) {
        stripeAccountId = `AADHAAR:${aadhaarClean}`;
      }

      const payload = {
        user_id: effectiveUserId,
        vehicle_type_id: vehicleTypeId,
        vehicle_make: driverData.vehicleMake || driverData.vehicle_make || 'Toyota',
        vehicle_model: driverData.vehicleModel || driverData.vehicle_model || 'Camry',
        vehicle_year: Number(driverData.vehicleYear || driverData.vehicle_year) || new Date().getFullYear(),
        license_plate: driverData.licensePlate || driverData.license_plate || `MH ${Math.floor(10 + Math.random() * 89)} CZ ${Math.floor(1000 + Math.random() * 8999)}`,
        vehicle_color: driverData.vehicleColor || driverData.vehicle_color || 'Silver',
        is_online: false,
        is_available: true,
        current_latitude: driverData.currentLatitude || 37.7749,
        current_longitude: driverData.currentLongitude || -122.4194,
        stripe_account_id: stripeAccountId,
        upi_id: upiIdClean || null,
        payout_method: driverData.payoutMethod || driverData.payout_method || 'UPI',
        updated_at: new Date().toISOString()
      };

      // 2. Upsert driver profile in cb_driver_profiles
      let dbPayload = { ...payload };
      let { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .upsert(dbPayload, { onConflict: 'user_id' })
        .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
        .single();

      if (error && error.message && (error.message.includes('upi_id') || error.message.includes('payout_method'))) {
        delete dbPayload.upi_id;
        delete dbPayload.payout_method;
        const retry = await client
          .from(DB_TABLES.DRIVER_PROFILES)
          .upsert(dbPayload, { onConflict: 'user_id' })
          .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        logger.error('Error registering driver in Supabase:', error);
        throw new Error(error.message);
      }

      // Merge extra client metadata for seamless frontend state
      return {
        ...data,
        fullName: userUpdatePayload.full_name,
        phone: userUpdatePayload.phone,
        email: userUpdatePayload.email,
        vehicleMake: payload.vehicle_make,
        vehicleModel: payload.vehicle_model,
        vehicleYear: payload.vehicle_year,
        vehicleColor: payload.vehicle_color,
        licensePlate: payload.license_plate,
        carImageUrl: userUpdatePayload.avatar_url,
        aadhaarNumber: aadhaarClean,
        drivingLicense: driverData.drivingLicense || driverData.driving_license,
        payoutMethod: driverData.payoutMethod || driverData.payout_method || 'UPI',
        upiId: upiIdClean || data?.upi_id || '',
        emergencyContactName: userUpdatePayload.emergency_contact_name,
        emergencyContactPhone: userUpdatePayload.emergency_contact_phone,
        totalEarnings: 0,
        totalRides: 0,
        rating: 5.0
      };
    }

    const payload = {
      user_id: effectiveUserId,
      vehicle_type_id: vehicleTypeId,
      vehicle_make: driverData.vehicleMake || driverData.vehicle_make || 'Toyota',
      vehicle_model: driverData.vehicleModel || driverData.vehicle_model || 'Camry',
      vehicle_year: Number(driverData.vehicleYear || driverData.vehicle_year) || new Date().getFullYear(),
      license_plate: driverData.licensePlate || driverData.license_plate || `MH ${Math.floor(10 + Math.random() * 89)} CZ ${Math.floor(1000 + Math.random() * 8999)}`,
      vehicle_color: driverData.vehicleColor || driverData.vehicle_color || 'Silver',
      is_online: false,
      is_available: true,
      current_latitude: driverData.currentLatitude || 37.7749,
      current_longitude: driverData.currentLongitude || -122.4194,
      stripe_account_id: driverData.aadhaarNumber ? `AADHAAR:${driverData.aadhaarNumber}` : null,
      upi_id: driverData.upiId || driverData.upi_id || null,
      payout_method: driverData.payoutMethod || driverData.payout_method || 'UPI',
      updated_at: new Date().toISOString()
    };

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
      let { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) {
        // Auto-provision a driver profile for the user in cb_driver_profiles so any driver account can accept rides
        const autoPayload = {
          user_id: userId,
          vehicle_type_id: 'economy',
          vehicle_make: 'Toyota',
          vehicle_model: 'Camry',
          vehicle_year: 2024,
          license_plate: `MH ${Math.floor(10 + Math.random() * 89)} CZ ${Math.floor(1000 + Math.random() * 8999)}`,
          vehicle_color: 'Silver Metallic',
          is_online: true,
          is_available: true,
          current_latitude: 22.5726,
          current_longitude: 88.3639,
          updated_at: new Date().toISOString()
        };

        const { data: created } = await client
          .from(DB_TABLES.DRIVER_PROFILES)
          .upsert(autoPayload, { onConflict: 'user_id' })
          .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
          .maybeSingle();

        if (created) {
          data = created;
        }
      }

      if (data) {
        const user = data.cb_users || {};
        const vehicleType = data.cb_vehicle_types || {};
        return {
          ...data,
          fullName: user.full_name || 'Driver Partner',
          phone: user.phone || '',
          email: user.email || '',
          vehicleMake: data.vehicle_make || 'Toyota',
          vehicleModel: data.vehicle_model || 'Camry',
          vehicleYear: data.vehicle_year || 2024,
          vehicleColor: data.vehicle_color || 'Silver',
          licensePlate: data.license_plate || 'DL 01 AB 1234',
          vehicleTypeId: data.vehicle_type_id || 'economy',
          vehicleTierName: vehicleType.name || 'UberX',
          carImageUrl: data.car_image_url || user.avatar_url || 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/HatchbackMini-Snowflake-520.png',
          aadhaarNumber: data.stripe_account_id && data.stripe_account_id.includes('AADHAAR:')
            ? data.stripe_account_id.match(/AADHAAR:([^|]+)/)?.[1]
            : (data.stripe_account_id && !data.stripe_account_id.includes('UPI:') ? data.stripe_account_id : ''),
          drivingLicense: data.driving_license || '',
          payoutMethod: data.payout_method || 'UPI',
          upiId: data.upi_id || (data.stripe_account_id && data.stripe_account_id.includes('UPI:') ? data.stripe_account_id.match(/UPI:([^|]+)/)?.[1] : '') || ''
        };
      }
    }
    return memoryDrivers.get(`user_${userId}`) || null;
  }

  static async updatePayoutMethod(userId, { payoutMethod = 'UPI', upiId = '' }) {
    const client = this.getClient();
    if (client) {
      const cleanUpi = (upiId || '').trim();
      let payload = {
        payout_method: payoutMethod,
        updated_at: new Date().toISOString()
      };
      if (cleanUpi) {
        payload.stripe_account_id = `UPI:${cleanUpi}`;
        payload.upi_id = cleanUpi;
      }
      let { data, error } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .update(payload)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error && error.message && (error.message.includes('upi_id') || error.message.includes('payout_method'))) {
        delete payload.upi_id;
        delete payload.payout_method;
        const retry = await client
          .from(DB_TABLES.DRIVER_PROFILES)
          .update(payload)
          .eq('user_id', userId)
          .select()
          .maybeSingle();
        data = retry.data;
      }
      if (error && !data) {
        logger.error('Error updating payout method in Supabase:', error);
      }
      return data;
    }
    return null;
  }

  static async getDriverById(driverId) {
    const client = this.getClient();
    if (client) {
      let { data } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
        .eq('id', driverId)
        .maybeSingle();

      if (!data) {
        // Fallback: check by user_id
        const { data: byUser } = await client
          .from(DB_TABLES.DRIVER_PROFILES)
          .select(`*, ${DB_TABLES.USERS}(full_name, email, phone, avatar_url), ${DB_TABLES.VEHICLE_TYPES}(*)`)
          .eq('user_id', driverId)
          .maybeSingle();
        if (byUser) data = byUser;
      }

      if (data) return data;
    }
    return memoryDrivers.get(driverId) || memoryDrivers.get(`user_${driverId}`) || null;
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
