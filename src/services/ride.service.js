import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { RIDE_STATUS, SOCKET_EVENTS } from '../config/constants.js';
import { FareService } from './fare.service.js';
import { calculateRideFare } from '../utils/fareCalculator.js';
import { PromoService } from './promo.service.js';
import { emitToUser, emitToDriver, broadcastToDrivers } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';

const memoryRides = new Map();

export class RideService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  static async requestRide(riderId, rideData) {
    const { totalDistanceKm, durationMin } = FareService.calculateRouteDistanceAndDuration(
      { latitude: rideData.pickupLatitude, longitude: rideData.pickupLongitude },
      { latitude: rideData.dropoffLatitude, longitude: rideData.dropoffLongitude },
      rideData.stops || []
    );

    let promo = null;
    if (rideData.promoCode) {
      promo = await PromoService.getPromoByCode(rideData.promoCode);
    }

    const fare = calculateRideFare({
      vehicleType: rideData.vehicleType || 'economy',
      distanceKm: totalDistanceKm,
      durationMin,
      surgeMultiplier: 1.0,
      promoCode: promo
    });

    const otp = this.generateOTP();
    const client = this.getClient();

    const payload = {
      rider_id: riderId,
      vehicle_type_id: rideData.vehicleType || 'economy',
      status: RIDE_STATUS.REQUESTED,
      pickup_address: rideData.pickupAddress,
      pickup_latitude: rideData.pickupLatitude,
      pickup_longitude: rideData.pickupLongitude,
      dropoff_address: rideData.dropoffAddress,
      dropoff_latitude: rideData.dropoffLatitude,
      dropoff_longitude: rideData.dropoffLongitude,
      stops: rideData.stops || [],
      distance_km: totalDistanceKm,
      duration_min: durationMin,
      base_fare: fare.baseFare,
      distance_fare: fare.distanceFare,
      time_fare: fare.timeFare,
      surge_multiplier: fare.surgeMultiplier,
      estimated_fare: fare.subtotal,
      discount_amount: fare.discountAmount,
      final_fare: fare.finalFare,
      promo_code_id: promo?.id || null,
      otp,
      created_at: new Date().toISOString()
    };

    let rideRecord = null;

    if (client) {
      const { data, error } = await client
        .from('rides')
        .insert(payload)
        .select('*, users!rides_rider_id_fkey(full_name, phone, avatar_url, rating), vehicle_types(*)')
        .single();

      if (error) {
        logger.error('Error creating ride in Supabase:', error);
        throw new Error(error.message);
      }
      rideRecord = data;
    } else {
      const id = crypto.randomUUID();
      rideRecord = { id, ...payload };
      memoryRides.set(id, rideRecord);
    }

    // Broadcast new ride offer to active drivers via Socket.io
    broadcastToDrivers(SOCKET_EVENTS.RIDE_NEW_OFFER, {
      rideId: rideRecord.id,
      pickupAddress: rideRecord.pickup_address,
      dropoffAddress: rideRecord.dropoff_address,
      pickupLatitude: rideRecord.pickup_latitude,
      pickupLongitude: rideRecord.pickup_longitude,
      dropoffLatitude: rideRecord.dropoff_latitude,
      dropoffLongitude: rideRecord.dropoff_longitude,
      distanceKm: rideRecord.distance_km,
      durationMin: rideRecord.duration_min,
      estimatedFare: rideRecord.final_fare || rideRecord.estimated_fare,
      vehicleType: rideRecord.vehicle_type_id
    });

    return rideRecord;
  }

  static async getRideById(rideId) {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from('rides')
        .select(`
          *,
          rider:users!rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:driver_profiles!rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude,
            driver_user:users(full_name, phone, avatar_url)
          ),
          vehicle_types(*)
        `)
        .eq('id', rideId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    }

    return memoryRides.get(rideId) || null;
  }

  static async getActiveRideForUser(userId) {
    const client = this.getClient();
    const activeStatuses = [
      RIDE_STATUS.REQUESTED,
      RIDE_STATUS.SEARCHING,
      RIDE_STATUS.ACCEPTED,
      RIDE_STATUS.ARRIVING,
      RIDE_STATUS.ARRIVED,
      RIDE_STATUS.IN_PROGRESS
    ];

    if (client) {
      const { data, error } = await client
        .from('rides')
        .select(`
          *,
          rider:users!rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:driver_profiles!rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude,
            driver_user:users(full_name, phone, avatar_url)
          ),
          vehicle_types(*)
        `)
        .eq('rider_id', userId)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    }

    for (const ride of memoryRides.values()) {
      if (ride.rider_id === userId && activeStatuses.includes(ride.status)) {
        return ride;
      }
    }
    return null;
  }

  static async getActiveRideForDriver(driverId) {
    const client = this.getClient();
    const activeStatuses = [
      RIDE_STATUS.ACCEPTED,
      RIDE_STATUS.ARRIVING,
      RIDE_STATUS.ARRIVED,
      RIDE_STATUS.IN_PROGRESS
    ];

    if (client) {
      const { data, error } = await client
        .from('rides')
        .select(`
          *,
          rider:users!rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          vehicle_types(*)
        `)
        .eq('driver_id', driverId)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    }

    for (const ride of memoryRides.values()) {
      if (ride.driver_id === driverId && activeStatuses.includes(ride.status)) {
        return ride;
      }
    }
    return null;
  }

  static async acceptRide(rideId, driverId) {
    const client = this.getClient();
    const ride = await this.getRideById(rideId);

    if (!ride) throw new Error('Ride not found');
    if (ride.status !== RIDE_STATUS.REQUESTED && ride.status !== RIDE_STATUS.SEARCHING) {
      throw new Error(`Ride is no longer available (current status: ${ride.status})`);
    }

    const updates = {
      driver_id: driverId,
      status: RIDE_STATUS.ACCEPTED,
      accepted_at: new Date().toISOString()
    };

    let updatedRide = null;

    if (client) {
      const { data, error } = await client
        .from('rides')
        .update(updates)
        .eq('id', rideId)
        .select(`
          *,
          rider:users!rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:driver_profiles!rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude,
            driver_user:users(full_name, phone, avatar_url)
          ),
          vehicle_types(*)
        `)
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;

      // Mark driver as occupied
      await client
        .from('driver_profiles')
        .update({ is_available: false })
        .eq('id', driverId);
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    // Notify Rider through WebSocket
    emitToUser(ride.rider_id, SOCKET_EVENTS.RIDE_ACCEPTED, {
      ride: updatedRide,
      message: 'A driver has accepted your ride request!'
    });

    return updatedRide;
  }

  static async updateRideStatus(rideId, newStatus, { otp = null, driverId = null } = {}) {
    const ride = await this.getRideById(rideId);
    if (!ride) throw new Error('Ride not found');

    const client = this.getClient();
    const updates = { status: newStatus };

    if (newStatus === RIDE_STATUS.IN_PROGRESS) {
      if (ride.otp && otp && ride.otp !== otp) {
        throw new Error('Invalid OTP provided. Please ask rider for their verification PIN.');
      }
      updates.started_at = new Date().toISOString();
    } else if (newStatus === RIDE_STATUS.COMPLETED) {
      updates.completed_at = new Date().toISOString();
    }

    let updatedRide = null;

    if (client) {
      const { data, error } = await client
        .from('rides')
        .update(updates)
        .eq('id', rideId)
        .select(`
          *,
          rider:users!rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:driver_profiles!rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude,
            driver_user:users(full_name, phone, avatar_url)
          ),
          vehicle_types(*)
        `)
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;

      if (newStatus === RIDE_STATUS.COMPLETED && ride.driver_id) {
        // Free up driver and increment stats
        const earnings = Math.round(Number(ride.final_fare || ride.estimated_fare) * 0.8 * 100) / 100;
        await client.rpc('increment_driver_stats', {
          driver_uuid: ride.driver_id,
          fare_amount: earnings
        }).catch(async () => {
          // Fallback if RPC isn't loaded
          await client
            .from('driver_profiles')
            .update({ is_available: true })
            .eq('id', ride.driver_id);
        });
      }
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    // Broadcast status change to both rider and driver
    emitToUser(ride.rider_id, `ride:status_${newStatus.toLowerCase()}`, { ride: updatedRide });
    if (ride.driver_id) {
      emitToDriver(ride.driver_id, `ride:status_${newStatus.toLowerCase()}`, { ride: updatedRide });
    }

    return updatedRide;
  }

  static async cancelRide(rideId, cancelledBy, reason) {
    const ride = await this.getRideById(rideId);
    if (!ride) throw new Error('Ride not found');

    if (ride.status === RIDE_STATUS.COMPLETED || ride.status === RIDE_STATUS.CANCELLED) {
      throw new Error(`Cannot cancel ride with status ${ride.status}`);
    }

    // Cancellation fee rule: if ride was accepted for more than 2 minutes, charge fee
    let cancellationFee = 0.0;
    if (ride.accepted_at) {
      const minutesSinceAccepted = (Date.now() - new Date(ride.accepted_at).getTime()) / 60000;
      if (minutesSinceAccepted > 2) {
        cancellationFee = Number(ride.vehicle_types?.cancellation_fee || 3.0);
      }
    }

    const updates = {
      status: RIDE_STATUS.CANCELLED,
      cancelled_by: cancelledBy,
      cancellation_reason: reason,
      cancellation_fee: cancellationFee,
      cancelled_at: new Date().toISOString()
    };

    const client = this.getClient();
    let updatedRide = null;

    if (client) {
      const { data, error } = await client
        .from('rides')
        .update(updates)
        .eq('id', rideId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;

      if (ride.driver_id) {
        await client
          .from('driver_profiles')
          .update({ is_available: true })
          .eq('id', ride.driver_id);
      }
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    // Notify parties
    emitToUser(ride.rider_id, SOCKET_EVENTS.RIDE_CANCELLED, { ride: updatedRide, reason });
    if (ride.driver_id) {
      emitToDriver(ride.driver_id, SOCKET_EVENTS.RIDE_CANCELLED, { ride: updatedRide, reason });
    }

    return updatedRide;
  }

  static async getRiderHistory(riderId, limit = 20, offset = 0) {
    const client = this.getClient();
    if (client) {
      const { data, error, count } = await client
        .from('rides')
        .select(
          `
          *,
          driver:driver_profiles!rides_driver_id_fkey(
            id, vehicle_make, vehicle_model, license_plate, rating,
            driver_user:users(full_name, avatar_url)
          ),
          vehicle_types(*),
          payments(*)
        `,
          { count: 'exact' }
        )
        .eq('rider_id', riderId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);
      return { rides: data || [], total: count || 0 };
    }

    const list = Array.from(memoryRides.values()).filter((r) => r.rider_id === riderId);
    return { rides: list.slice(offset, offset + limit), total: list.length };
  }

  static async getDriverHistory(driverId, limit = 20, offset = 0) {
    const client = this.getClient();
    if (client) {
      const { data, error, count } = await client
        .from('rides')
        .select(
          `
          *,
          rider:users!rides_rider_id_fkey(id, full_name, avatar_url, rating),
          vehicle_types(*),
          payments(*)
        `,
          { count: 'exact' }
        )
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);
      return { rides: data || [], total: count || 0 };
    }

    const list = Array.from(memoryRides.values()).filter((r) => r.driver_id === driverId);
    return { rides: list.slice(offset, offset + limit), total: list.length };
  }
}
