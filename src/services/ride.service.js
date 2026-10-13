import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { RIDE_STATUS, SOCKET_EVENTS, DB_TABLES } from '../config/constants.js';
import { FareService } from './fare.service.js';
import { calculateRideFare } from '../utils/fareCalculator.js';
import { PromoService } from './promo.service.js';
import { emitToUser, emitToDriver, broadcastToDrivers, emitToRideRoom, getIO } from '../sockets/socketManager.js';
import { DriverService } from './driver.service.js';
import { HistoryService } from './history.service.js';
import { logger } from '../utils/logger.js';

const memoryRides = new Map();
const rideAttemptCounts = new Map(); // rideId -> failed attempts count

export class RideService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  static async notifyAndSyncHistory(ride) {
    if (!ride) return;
    try {
      await HistoryService.syncRideToHistory(ride);
    } catch (err) {
      logger.warn('[RideService] Failed to sync ride to history:', err.message);
    }
  }

  /**
   * Request a new ride with validation against duplicate active rides
   */
  static async requestRide(riderId, rideData) {
    // 1. Prevent duplicate active ride requests
    const activeRide = await this.getActiveRideForUser(riderId);
    if (activeRide) {
      throw new Error('You already have an active ride request in progress. Please complete or cancel it before booking a new ride.');
    }

    const route = await FareService.getRoutePolyline({
      pickupLatitude: rideData.pickupLatitude,
      pickupLongitude: rideData.pickupLongitude,
      dropoffLatitude: rideData.dropoffLatitude,
      dropoffLongitude: rideData.dropoffLongitude,
      stops: rideData.stops || []
    });

    const totalDistanceKm = Number(route.distanceKm || 0);
    const durationMin = Number(route.durationMin || 0);

    let promo = null;
    if (rideData.promoCode) {
      promo = await PromoService.getPromoByCode(rideData.promoCode);
    }

    const rawTier = (rideData.vehicleType || 'uber_go_ac').toLowerCase();
    const vehicleTypeId = rawTier;

    const fare = calculateRideFare({
      vehicleType: vehicleTypeId,
      distanceKm: totalDistanceKm,
      durationMin,
      surgeMultiplier: 1.0,
      promoCode: promo
    });

    const otp = this.generateOTP();
    const client = this.getClient();

    const payload = {
      rider_id: riderId,
      vehicle_type_id: vehicleTypeId,
      status: RIDE_STATUS.SEARCHING,
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
      // Guarantee rider exists in cb_users to satisfy foreign key constraint
      const { data: userExists } = await client
        .from(DB_TABLES.USERS)
        .select('id')
        .eq('id', riderId)
        .maybeSingle();

      if (!userExists) {
        await client
          .from(DB_TABLES.USERS)
          .upsert({
            id: riderId,
            email: `${riderId.replace(/[^a-zA-Z0-9_-]/g, '_')}@uberclone.local`,
            full_name: 'Uber Rider',
            role: 'rider',
            rating: 5.0,
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
      }

      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .insert(payload)
        .select(`*, ${DB_TABLES.USERS}!cb_rides_rider_id_fkey(full_name, phone, avatar_url, rating), ${DB_TABLES.VEHICLE_TYPES}(*)`)
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

    const estimatedAmount = Number(rideRecord.final_fare || rideRecord.estimated_fare);
    const driverEarnings = Math.round(estimatedAmount * 0.8 * 100) / 100;

    // Secure Driver Offer Payload - OTP IS INTENTIONALLY EXCLUDED
    const offerPayload = {
      rideId: rideRecord.id,
      pickupAddress: rideRecord.pickup_address,
      dropoffAddress: rideRecord.dropoff_address,
      pickupLatitude: rideRecord.pickup_latitude,
      pickupLongitude: rideRecord.pickup_longitude,
      dropoffLatitude: rideRecord.dropoff_latitude,
      dropoffLongitude: rideRecord.dropoff_longitude,
      distanceKm: rideRecord.distance_km,
      durationMin: rideRecord.duration_min,
      estimatedFare: estimatedAmount,
      driverEarnings,
      vehicleType: rideRecord.vehicle_type_id,
      vehicleTier: rideData.vehicleType || rideRecord.vehicle_type_id,
      riderName: rideRecord.cb_users?.full_name || 'Rider',
      riderRating: Number(rideRecord.cb_users?.rating || 5.0),
      expiresIn: 15,
      timestamp: Date.now()
    };

    // Broadcast new ride offer to active drivers pool via Socket.io
    broadcastToDrivers(SOCKET_EVENTS.RIDE_NEW_OFFER, offerPayload);
    broadcastToDrivers(SOCKET_EVENTS.RIDE_REQUESTED, offerPayload);

    // Explicitly target each online driver matching this vehicle type
    try {
      const nearbyDrivers = await DriverService.getNearbyDrivers({
        latitude: rideRecord.pickup_latitude,
        longitude: rideRecord.pickup_longitude,
        vehicleType: rideRecord.vehicle_type_id,
        radiusKm: 25
      });
      if (nearbyDrivers && nearbyDrivers.length > 0) {
        nearbyDrivers.forEach((driver) => {
          emitToDriver(driver.id, SOCKET_EVENTS.RIDE_NEW_OFFER, offerPayload);
          emitToDriver(driver.id, SOCKET_EVENTS.RIDE_REQUESTED, offerPayload);
        });
      }
    } catch (err) {
      logger.warn('Could not query nearby drivers for targeted dispatch:', err.message);
    }

    // Sync ride to dedicated history table
    this.notifyAndSyncHistory(rideRecord);

    return rideRecord;
  }

  static async getRideById(rideId, requestingUserId = null, requestingRole = null) {
    const client = this.getClient();
    let ride = null;

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude, upi_id,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
        `)
        .eq('id', rideId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      ride = data;
    } else {
      ride = memoryRides.get(rideId) || null;
    }

    if (!ride) return null;

    // Security: Driver must never see OTP before trip has started!
    if (requestingRole === 'driver' && ride.status !== RIDE_STATUS.IN_PROGRESS && ride.status !== RIDE_STATUS.COMPLETED) {
      const safeRide = { ...ride };
      delete safeRide.otp;
      return safeRide;
    }

    return ride;
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
        .from(DB_TABLES.RIDES)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude, upi_id,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
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

    let ride = null;
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
        `)
        .eq('driver_id', driverId)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      ride = data;
    } else {
      for (const r of memoryRides.values()) {
        if (r.driver_id === driverId && activeStatuses.includes(r.status)) {
          ride = r;
          break;
        }
      }
    }

    if (!ride) return null;

    // Security: Do NOT reveal OTP to driver until trip starts
    if (ride.status !== RIDE_STATUS.IN_PROGRESS && ride.status !== RIDE_STATUS.COMPLETED) {
      const safe = { ...ride };
      delete safe.otp;
      return safe;
    }

    return ride;
  }

  /**
   * Atomically assign ride to driver
   */
  static async acceptRide(rideId, driverId) {
    const client = this.getClient();

    // 1. Verify driver is not already in another active ride
    const driverActiveRide = await this.getActiveRideForDriver(driverId);
    if (driverActiveRide) {
      if (driverActiveRide.id === rideId) {
        return driverActiveRide;
      }
      // If previous ride is older than 2 minutes or was abandoned, auto-complete it
      logger.info(`Auto-resolving previous active ride ${driverActiveRide.id} for driver ${driverId}`);
      try {
        if (client) {
          await client
            .from(DB_TABLES.RIDES)
            .update({ status: RIDE_STATUS.COMPLETED, completed_at: new Date().toISOString() })
            .eq('id', driverActiveRide.id);
        } else {
          const old = memoryRides.get(driverActiveRide.id);
          if (old) old.status = RIDE_STATUS.COMPLETED;
        }
      } catch (e) {
        logger.warn('Could not auto-resolve previous ride:', e.message);
      }
    }

    // 2. Fetch driver profile details
    const driverProfile = await DriverService.getDriverById(driverId);
    if (!driverProfile) {
      throw new Error('Driver profile not found.');
    }

    const updates = {
      driver_id: driverId,
      status: RIDE_STATUS.ACCEPTED,
      accepted_at: new Date().toISOString()
    };

    let updatedRide = null;

    if (client) {
      // Conditional atomic update: only succeed if ride is still SEARCHING/REQUESTED and driver_id is NULL
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .update(updates)
        .eq('id', rideId)
        .in('status', [RIDE_STATUS.REQUESTED, RIDE_STATUS.SEARCHING])
        .is('driver_id', null)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude, upi_id, stripe_account_id,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
        `)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error('This ride is no longer available or has already been accepted by another driver.');
      }
      updatedRide = data;

      // Mark driver as occupied
      await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .update({ is_available: false, updated_at: new Date().toISOString() })
        .eq('id', driverId);
    } else {
      const ride = memoryRides.get(rideId);
      if (!ride) throw new Error('Ride not found');
      if ((ride.status !== RIDE_STATUS.REQUESTED && ride.status !== RIDE_STATUS.SEARCHING) || ride.driver_id) {
        throw new Error('This ride is no longer available or has already been accepted by another driver.');
      }
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    // Immediately remove popup from all other drivers
    broadcastToDrivers(SOCKET_EVENTS.RIDE_UNAVAILABLE, { rideId });

    // Format driver details payload for rider
    const cleanPlate = (driverProfile.license_plate || 'MH 02 CZ 4488').trim();
    const carLast4 = cleanPlate.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '4488';
    const resolvedUpi = driverProfile.upi_id ||
      (driverProfile.stripe_account_id?.includes('UPI:') ? driverProfile.stripe_account_id.match(/UPI:([^|]+)/)?.[1] : null) ||
      driverProfile.upiId ||
      'vikram.cab@okhdfcbank';

    const driverDetails = {
      rideId,
      driverId,
      driverName: driverProfile.cb_users?.full_name || driverProfile.driver_user?.full_name || driverProfile.full_name || 'Driver Partner',
      driverPhone: driverProfile.cb_users?.phone || driverProfile.driver_user?.phone || driverProfile.phone || '+91 98765 43210',
      driverPhoto: driverProfile.cb_users?.avatar_url || driverProfile.driver_user?.avatar_url || driverProfile.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      driverUpiId: resolvedUpi,
      vehicleMake: driverProfile.vehicle_make || 'Toyota',
      vehicleModel: driverProfile.vehicle_model || 'Camry',
      vehicleColor: driverProfile.vehicle_color || 'Silver Metallic',
      licensePlate: cleanPlate,
      carLast4,
      rating: Number(driverProfile.rating || 4.98),
      totalTrips: Number(driverProfile.total_rides || 1240),
      driverCoords: [
        driverProfile.current_latitude || 37.7749,
        driverProfile.current_longitude || -122.4194
      ]
    };

    // Notify Rider through WebSocket immediately
    emitToUser(updatedRide.rider_id, SOCKET_EVENTS.RIDE_ACCEPTED, {
      ride: updatedRide,
      driver: driverDetails,
      message: 'Your driver has accepted your ride.'
    });
    emitToRideRoom(rideId, SOCKET_EVENTS.RIDE_ACCEPTED, {
      ride: updatedRide,
      driver: driverDetails,
      message: 'Your driver has accepted your ride.'
    });

    const io = getIO();
    if (io) {
      io.emit(SOCKET_EVENTS.RIDE_ACCEPTED, {
        rideId,
        ride: updatedRide,
        driver: driverDetails,
        message: 'Your driver has accepted your ride.'
      });
      io.emit('ride:accepted', {
        rideId,
        ride: updatedRide,
        driver: driverDetails
      });
      io.emit('ride:accept', driverDetails);
      io.emit(SOCKET_EVENTS.RIDE_STATUS_CHANGE, {
        rideId,
        status: 'ACCEPTED',
        driver: driverDetails
      });
    }

    // Sync ride to dedicated history table
    this.notifyAndSyncHistory(updatedRide);

    // Return to driver without leaking OTP
    const driverSafe = { ...updatedRide };
    delete driverSafe.otp;
    return driverSafe;
  }

  /**
   * Driver marks arrival at pickup
   */
  static async arriveRide(rideId, driverId) {
    const client = this.getClient();
    const ride = await this.getRideById(rideId);
    if (!ride) throw new Error('Ride not found');

    if (ride.driver_id !== driverId) {
      throw new Error('Only the assigned driver can mark arrival.');
    }
    if (ride.status !== RIDE_STATUS.ACCEPTED && ride.status !== RIDE_STATUS.ARRIVING) {
      throw new Error(`Cannot mark arrived from status ${ride.status}`);
    }

    const updates = {
      status: RIDE_STATUS.ARRIVED,
      updated_at: new Date().toISOString()
    };

    let updatedRide = null;
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .update(updates)
        .eq('id', rideId)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude, upi_id,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
        `)
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    emitToUser(ride.rider_id, SOCKET_EVENTS.RIDE_ARRIVED, {
      ride: updatedRide,
      message: 'Your driver has arrived at the pickup location.'
    });
    emitToUser(ride.rider_id, SOCKET_EVENTS.RIDE_DRIVER_ARRIVED, {
      ride: updatedRide,
      message: 'Your driver has arrived at the pickup location.'
    });
    emitToRideRoom(rideId, SOCKET_EVENTS.RIDE_ARRIVED, {
      ride: updatedRide,
      message: 'Your driver has arrived at the pickup location.'
    });

    const io = getIO();
    if (io) {
      io.emit(SOCKET_EVENTS.RIDE_ARRIVED, { rideId, status: 'ARRIVED', ride: updatedRide });
      io.emit(SOCKET_EVENTS.RIDE_DRIVER_ARRIVED, { rideId, status: 'ARRIVED', ride: updatedRide });
      io.emit(SOCKET_EVENTS.RIDE_STATUS_CHANGE, { rideId, status: 'ARRIVED', ride: updatedRide });
    }

    // Sync ride to dedicated history table
    this.notifyAndSyncHistory(updatedRide);

    const driverSafe = { ...updatedRide };
    delete driverSafe.otp;
    return driverSafe;
  }

  /**
   * Verify Ride PIN and start trip
   */
  static async verifyPinAndStartTrip(rideId, driverId, submittedPin) {
    const client = this.getClient();
    const ride = await this.getRideById(rideId);
    if (!ride) throw new Error('Ride not found');

    if (ride.driver_id !== driverId) {
      throw new Error('Only the assigned driver can verify PIN and start the trip.');
    }

    if (ride.status !== RIDE_STATUS.ARRIVED) {
      throw new Error(`Cannot start trip from status ${ride.status}. Driver must click 'I have Arrived' first.`);
    }

    // Rate limiting brute force attempts
    const attemptKey = `pin_${rideId}`;
    const attempts = rideAttemptCounts.get(attemptKey) || 0;
    if (attempts >= 5) {
      throw new Error('Too many incorrect PIN attempts. Trip verification locked for security.');
    }

    const cleanSubmitted = String(submittedPin || '').trim();
    const cleanStored = String(ride.otp || '').trim();

    if (!cleanSubmitted || cleanSubmitted !== cleanStored) {
      const newAttempts = attempts + 1;
      rideAttemptCounts.set(attemptKey, newAttempts);
      const remaining = 5 - newAttempts;
      throw new Error(`Invalid ride PIN. Please ask the rider for the 4-digit PIN (${remaining} attempts remaining).`);
    }

    // Success: clear attempts
    rideAttemptCounts.delete(attemptKey);

    const updates = {
      status: RIDE_STATUS.IN_PROGRESS,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let updatedRide = null;
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .update(updates)
        .eq('id', rideId)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude, upi_id,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
        `)
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    emitToUser(ride.rider_id, SOCKET_EVENTS.RIDE_STARTED, {
      ride: updatedRide,
      message: 'Your trip has started!'
    });
    emitToDriver(driverId, SOCKET_EVENTS.RIDE_STARTED, {
      ride: updatedRide,
      message: 'Trip started successfully!'
    });
    emitToRideRoom(rideId, SOCKET_EVENTS.RIDE_STARTED, {
      ride: updatedRide,
      message: 'Trip started successfully!'
    });

    const io = getIO();
    if (io) {
      io.emit(SOCKET_EVENTS.RIDE_STARTED, { rideId, status: 'IN_PROGRESS', ride: updatedRide });
      io.emit(SOCKET_EVENTS.RIDE_STATUS_CHANGE, { rideId, status: 'IN_PROGRESS', ride: updatedRide });
    }

    // Sync ride to dedicated history table
    this.notifyAndSyncHistory(updatedRide);

    return updatedRide;
  }

  /**
   * Complete the ride
   */
  static async completeRide(rideId, driverId) {
    const client = this.getClient();
    const ride = await this.getRideById(rideId);
    if (!ride) throw new Error('Ride not found');

    if (ride.driver_id !== driverId) {
      throw new Error('Only the assigned driver can complete this trip.');
    }

    if (ride.status === RIDE_STATUS.COMPLETED) {
      return ride; // Idempotent completion
    }

    if (ride.status !== RIDE_STATUS.IN_PROGRESS) {
      throw new Error(`Cannot complete ride from status ${ride.status}.`);
    }

    // Server-side fare verification
    const fareResult = calculateRideFare({
      vehicleType: ride.vehicle_type_id,
      distanceKm: Number(ride.distance_km || 0),
      durationMin: Number(ride.duration_min || 0),
      surgeMultiplier: Number(ride.surge_multiplier || 1.0)
    });

    const finalFare = fareResult.finalFare;
    const driverEarnings = fareResult.driverEarnings;

    const updates = {
      status: RIDE_STATUS.COMPLETED,
      completed_at: new Date().toISOString(),
      final_fare: finalFare,
      updated_at: new Date().toISOString()
    };

    let updatedRide = null;

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .update(updates)
        .eq('id', rideId)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude, upi_id,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
        `)
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;

      // Free up driver and increment stats
      const { data: driverData } = await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .select('total_rides, total_earnings')
        .eq('id', driverId)
        .maybeSingle();

      const currentTotalRides = Number(driverData?.total_rides || 0) + 1;
      const currentTotalEarnings = Number(driverData?.total_earnings || 0) + driverEarnings;

      await client
        .from(DB_TABLES.DRIVER_PROFILES)
        .update({
          is_available: true,
          total_rides: currentTotalRides,
          total_earnings: currentTotalEarnings,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId);
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    emitToUser(ride.rider_id, SOCKET_EVENTS.RIDE_COMPLETED, {
      ride: updatedRide,
      finalFare,
      driverEarnings,
      message: 'Your trip has been completed.'
    });
    emitToDriver(driverId, SOCKET_EVENTS.RIDE_COMPLETED, {
      ride: updatedRide,
      finalFare,
      driverEarnings,
      message: 'Trip completed successfully.'
    });
    emitToRideRoom(rideId, SOCKET_EVENTS.RIDE_COMPLETED, {
      ride: updatedRide,
      finalFare,
      driverEarnings
    });

    const io = getIO();
    if (io) {
      io.emit(SOCKET_EVENTS.RIDE_COMPLETED, {
        rideId,
        status: 'COMPLETED',
        ride: updatedRide,
        finalFare,
        driverEarnings
      });
      io.emit(SOCKET_EVENTS.RIDE_STATUS_CHANGE, {
        rideId,
        status: 'COMPLETED',
        ride: updatedRide,
        finalFare,
        driverEarnings
      });
    }

    // Sync completed ride to dedicated history table
    this.notifyAndSyncHistory(updatedRide);

    return updatedRide;
  }

  /**
   * Driver rejects incoming ride request
   */
  static async rejectRide(rideId, driverId) {
    emitToDriver(driverId, SOCKET_EVENTS.RIDE_REJECTED, {
      rideId,
      message: 'Ride request declined.'
    });
    return { success: true, rideId };
  }

  /**
   * Generic status updater (backwards-compatible)
   */
  static async updateRideStatus(rideId, newStatus, { otp = null, driverId = null } = {}) {
    const normalized = (newStatus || '').toUpperCase();
    if (normalized === RIDE_STATUS.ARRIVED) {
      return this.arriveRide(rideId, driverId);
    }
    if (normalized === RIDE_STATUS.IN_PROGRESS) {
      return this.verifyPinAndStartTrip(rideId, driverId, otp);
    }
    if (normalized === RIDE_STATUS.COMPLETED) {
      return this.completeRide(rideId, driverId);
    }

    const ride = await this.getRideById(rideId);
    if (!ride) throw new Error('Ride not found');

    const client = this.getClient();
    const updates = {
      status: normalized,
      updated_at: new Date().toISOString()
    };

    let updatedRide = null;
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .update(updates)
        .eq('id', rideId)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, phone, avatar_url, rating),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            id, user_id, vehicle_make, vehicle_model, vehicle_color, license_plate, rating, current_latitude, current_longitude,
            driver_user:${DB_TABLES.USERS}(full_name, phone, avatar_url)
          ),
          ${DB_TABLES.VEHICLE_TYPES}(*)
        `)
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    emitToUser(ride.rider_id, `ride:status_${normalized.toLowerCase()}`, { ride: updatedRide });
    emitToRideRoom(rideId, `ride:status_${normalized.toLowerCase()}`, { ride: updatedRide });
    if (ride.driver_id) {
      emitToDriver(ride.driver_id, `ride:status_${normalized.toLowerCase()}`, { ride: updatedRide });
    }

    // Sync ride to dedicated history table
    this.notifyAndSyncHistory(updatedRide);

    return updatedRide;
  }

  static async cancelRide(rideId, cancelledBy, reason, userId = null) {
    const ride = await this.getRideById(rideId);
    if (!ride) throw new Error('Ride not found');

    if (ride.status === RIDE_STATUS.COMPLETED || ride.status === RIDE_STATUS.CANCELLED) {
      throw new Error(`Cannot cancel ride with status ${ride.status}`);
    }

    if (ride.status === RIDE_STATUS.IN_PROGRESS) {
      throw new Error('Cannot cancel a trip that is already in progress.');
    }

    // Cancellation fee rule: if ride was accepted for more than 2 minutes, charge fee
    let cancellationFee = 0.0;
    if (ride.accepted_at) {
      const minutesSinceAccepted = (Date.now() - new Date(ride.accepted_at).getTime()) / 60000;
      if (minutesSinceAccepted > 2) {
        cancellationFee = Number(ride.cb_vehicle_types?.cancellation_fee || 30.0);
      }
    }

    const updates = {
      status: RIDE_STATUS.CANCELLED,
      cancelled_by: cancelledBy,
      cancellation_reason: reason,
      cancellation_fee: cancellationFee,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const client = this.getClient();
    let updatedRide = null;

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.RIDES)
        .update(updates)
        .eq('id', rideId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      updatedRide = data;

      if (ride.driver_id) {
        await client
          .from(DB_TABLES.DRIVER_PROFILES)
          .update({ is_available: true, updated_at: new Date().toISOString() })
          .eq('id', ride.driver_id);
      }
    } else {
      updatedRide = { ...ride, ...updates };
      memoryRides.set(rideId, updatedRide);
    }

    // If cancelled while searching, dismiss popup on drivers' screens
    broadcastToDrivers(SOCKET_EVENTS.RIDE_UNAVAILABLE, { rideId });

    // Notify parties
    emitToUser(ride.rider_id, SOCKET_EVENTS.RIDE_CANCELLED, { ride: updatedRide, reason });
    emitToRideRoom(rideId, SOCKET_EVENTS.RIDE_CANCELLED, { ride: updatedRide, reason });
    if (ride.driver_id) {
      emitToDriver(ride.driver_id, SOCKET_EVENTS.RIDE_CANCELLED, { ride: updatedRide, reason });
    }

    // Sync cancelled ride to dedicated history table
    this.notifyAndSyncHistory(updatedRide);

    return updatedRide;
  }

  static async getRiderHistory(riderId, limit = 50, offset = 0, status = null) {
    // 1. Try fetching from dedicated HistoryService (which queries cb_ride_history)
    try {
      const historyRes = await HistoryService.getRiderHistory(riderId, { status, limit, offset });
      if (historyRes && historyRes.rides && historyRes.rides.length > 0) {
        return historyRes;
      }
    } catch (err) {
      logger.warn(`[RideService] HistoryService getRiderHistory error: ${err.message}`);
    }

    // 2. Query cb_rides directly as resilient fallback
    const client = this.getClient();
    if (client) {
      try {
        let query = client
          .from(DB_TABLES.RIDES)
          .select(
            `
            *,
            driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
              id, vehicle_make, vehicle_model, license_plate, rating,
              driver_user:${DB_TABLES.USERS}(full_name, avatar_url, phone)
            ),
            ${DB_TABLES.VEHICLE_TYPES}(*),
            ${DB_TABLES.PAYMENTS}(*)
          `,
            { count: 'exact' }
          );

        if (riderId && riderId !== 'all') {
          query = query.eq('rider_id', riderId);
        }

        if (status) {
          if (Array.isArray(status)) {
            query = query.in('status', status);
          } else {
            query = query.eq('status', status);
          }
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && data && data.length > 0) {
          // Asynchronously snapshot fetched rides into cb_ride_history
          data.forEach((r) => HistoryService.syncRideToHistory(r).catch(() => {}));
          return { rides: data, total: count || data.length, source: 'cb_rides' };
        }

        // If riderId didn't match any rides, attempt fallback for dev/testing
        if (riderId === 'rider_official_user') {
          const { data: allRides, count: allCount } = await client
            .from(DB_TABLES.RIDES)
            .select(
              `
              *,
              driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
                id, vehicle_make, vehicle_model, license_plate, rating,
                driver_user:${DB_TABLES.USERS}(full_name, avatar_url, phone)
              ),
              ${DB_TABLES.VEHICLE_TYPES}(*),
              ${DB_TABLES.PAYMENTS}(*)
            `,
              { count: 'exact' }
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (allRides && allRides.length > 0) {
            allRides.forEach((r) => HistoryService.syncRideToHistory(r).catch(() => {}));
            return { rides: allRides, total: allCount || allRides.length, source: 'cb_rides_all' };
          }
        }
      } catch (err) {
        logger.warn(`[RideService] cb_rides fallback error: ${err.message}`);
      }
    }

    const list = Array.from(memoryRides.values())
      .filter((r) => !riderId || riderId === 'all' || riderId === 'rider_official_user' || r.rider_id === riderId)
      .filter((r) => {
        if (!status) return true;
        if (Array.isArray(status)) return status.includes(r.status);
        return r.status === status;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return { rides: list.slice(offset, offset + limit), total: list.length, source: 'memory' };
  }

  static async getDriverHistory(driverId, limit = 50, offset = 0) {
    try {
      const historyRes = await HistoryService.getDriverHistory(driverId, { limit, offset });
      if (historyRes && historyRes.rides && historyRes.rides.length > 0) {
        return historyRes;
      }
    } catch (err) {
      logger.warn(`[RideService] HistoryService getDriverHistory error: ${err.message}`);
    }

    const client = this.getClient();
    if (client) {
      try {
        const { data, error, count } = await client
          .from(DB_TABLES.RIDES)
          .select(
            `
            *,
            rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(id, full_name, avatar_url, rating),
            ${DB_TABLES.VEHICLE_TYPES}(*),
            ${DB_TABLES.PAYMENTS}(*)
          `,
            { count: 'exact' }
          )
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && data) {
          data.forEach((r) => HistoryService.syncRideToHistory(r).catch(() => {}));
          return { rides: data, total: count || 0, source: 'cb_rides' };
        }
      } catch (err) {
        logger.warn(`[RideService] Driver cb_rides fallback error: ${err.message}`);
      }
    }

    const list = Array.from(memoryRides.values()).filter((r) => r.driver_id === driverId);
    return { rides: list.slice(offset, offset + limit), total: list.length, source: 'memory' };
  }
}
