import { supabaseAdmin, supabase } from '../config/supabase.js';
import { DB_TABLES, RIDE_STATUS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

// In-memory fallback for ride history in case database table is initializing or offline
const memoryRideHistory = new Map();

export class HistoryService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  /**
   * Format and snapshot a ride into the dedicated cb_ride_history table
   */
  static async syncRideToHistory(ride) {
    if (!ride || !ride.id) return null;

    const rideId = String(ride.id);
    const historyEntry = {
      ride_id: rideId,
      rider_id: String(ride.rider_id || 'guest_rider'),
      rider_name: ride.rider?.full_name || ride.rider_name || 'Rider',
      rider_phone: ride.rider?.phone || ride.rider_phone || null,
      driver_id: ride.driver_id ? String(ride.driver_id) : null,
      driver_name: ride.driver?.driver_user?.full_name || ride.driver_name || null,
      driver_phone: ride.driver?.driver_user?.phone || ride.driver_phone || null,
      driver_avatar: ride.driver?.driver_user?.avatar_url || ride.driver_avatar || null,
      driver_rating: Number(ride.driver?.rating || ride.driver_rating || 4.90),
      vehicle_type_id: ride.vehicle_type_id || ride.vehicleType || 'uber_go_ac',
      vehicle_name: ride.cb_vehicle_types?.name || ride.vehicle_name || 'Uber Go',
      vehicle_model: ride.driver?.vehicle_model || ride.vehicle_model || 'Sedan',
      vehicle_plate: ride.driver?.license_plate || ride.license_plate || 'WB-01-2024',
      status: ride.status || RIDE_STATUS.REQUESTED,
      pickup_address: ride.pickup_address || 'Pickup Point',
      pickup_latitude: ride.pickup_latitude ? Number(ride.pickup_latitude) : null,
      pickup_longitude: ride.pickup_longitude ? Number(ride.pickup_longitude) : null,
      dropoff_address: ride.dropoff_address || 'Destination Point',
      dropoff_latitude: ride.dropoff_latitude ? Number(ride.dropoff_latitude) : null,
      dropoff_longitude: ride.dropoff_longitude ? Number(ride.dropoff_longitude) : null,
      stops: ride.stops || [],
      distance_km: Number(ride.distance_km || 0),
      duration_min: Number(ride.duration_min || 0),
      base_fare: Number(ride.base_fare || 0),
      distance_fare: Number(ride.distance_fare || 0),
      time_fare: Number(ride.time_fare || 0),
      surge_multiplier: Number(ride.surge_multiplier || 1.0),
      discount_amount: Number(ride.discount_amount || 0),
      final_fare: Number(ride.final_fare || ride.estimated_fare || 0),
      otp: ride.otp || null,
      payment_method: ride.payment_method || 'cash',
      payment_status: ride.payment_status || (ride.status === RIDE_STATUS.COMPLETED ? 'SUCCEEDED' : 'PENDING'),
      receipt_url: ride.receipt_url || null,
      cancellation_reason: ride.cancellation_reason || null,
      cancelled_by: ride.cancelled_by || null,
      accepted_at: ride.accepted_at || null,
      started_at: ride.started_at || null,
      completed_at: ride.completed_at || null,
      cancelled_at: ride.cancelled_at || null,
      created_at: ride.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save to memory cache
    memoryRideHistory.set(rideId, historyEntry);

    const client = this.getClient();
    if (!client) {
      return historyEntry;
    }

    try {
      // Upsert into dedicated cb_ride_history table
      const { data: existing } = await client
        .from(DB_TABLES.RIDE_HISTORY)
        .select('id')
        .eq('ride_id', rideId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await client
          .from(DB_TABLES.RIDE_HISTORY)
          .update(historyEntry)
          .eq('ride_id', rideId)
          .select()
          .single();

        if (!error && data) return data;
      } else {
        const { data, error } = await client
          .from(DB_TABLES.RIDE_HISTORY)
          .insert(historyEntry)
          .select()
          .single();

        if (!error && data) return data;
      }
    } catch (err) {
      // Gracefully catch missing table error (PGRST205) or others
      logger.warn(`[HistoryService] Table ${DB_TABLES.RIDE_HISTORY} write skipped or not yet created: ${err.message}`);
    }

    return historyEntry;
  }

  /**
   * Fetch all rides for a rider from cb_ride_history (with fallback to cb_rides)
   */
  static async getRiderHistory(riderId, { status = null, limit = 50, offset = 0 } = {}) {
    const client = this.getClient();

    if (client) {
      try {
        let query = client
          .from(DB_TABLES.RIDE_HISTORY)
          .select('*', { count: 'exact' })
          .eq('rider_id', riderId);

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
          return { rides: data, total: count || data.length, source: 'cb_ride_history' };
        }
      } catch (err) {
        logger.warn(`[HistoryService] cb_ride_history query warning: ${err.message}`);
      }
    }

    // Fallback to memoryRideHistory or return memory items
    const memList = Array.from(memoryRideHistory.values())
      .filter((r) => r.rider_id === riderId || riderId === 'all')
      .filter((r) => {
        if (!status) return true;
        if (Array.isArray(status)) return status.includes(r.status);
        return r.status === status;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (memList.length > 0) {
      return {
        rides: memList.slice(offset, offset + limit),
        total: memList.length,
        source: 'memory_history'
      };
    }

    return { rides: [], total: 0, source: 'empty' };
  }

  /**
   * Fetch all rides for driver
   */
  static async getDriverHistory(driverId, { limit = 50, offset = 0 } = {}) {
    const client = this.getClient();
    if (client) {
      try {
        const { data, count, error } = await client
          .from(DB_TABLES.RIDE_HISTORY)
          .select('*', { count: 'exact' })
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && data && data.length > 0) {
          return { rides: data, total: count || data.length, source: 'cb_ride_history' };
        }
      } catch (err) {
        logger.warn(`[HistoryService] cb_ride_history driver query warning: ${err.message}`);
      }
    }

    const memList = Array.from(memoryRideHistory.values())
      .filter((r) => r.driver_id === driverId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { rides: memList.slice(offset, offset + limit), total: memList.length, source: 'memory_history' };
  }
}
