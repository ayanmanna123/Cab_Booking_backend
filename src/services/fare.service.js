import { supabaseAdmin, supabase } from '../config/supabase.js';
import { DB_TABLES } from '../config/constants.js';
import { calculateHaversineDistance, estimateDurationMinutes, getOsrmRoute } from '../utils/geoUtils.js';
import { calculateRideFare, DEFAULT_VEHICLE_RATES } from '../utils/fareCalculator.js';
import { PromoService } from './promo.service.js';

export class FareService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async getVehicleTypes() {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.VEHICLE_TYPES)
        .select('*')
        .eq('is_active', true);

      if (!error && data && data.length > 0) {
        return data;
      }
    }

    return Object.entries(DEFAULT_VEHICLE_RATES).map(([id, rates]) => ({
      id,
      name: rates.name,
      description: rates.description || `${rates.name} ride service`,
      capacity: rates.capacity,
      image_url: rates.imageUrl || rates.image_url,
      base_fare: rates.baseFare,
      per_km_rate: rates.perKmRate,
      per_minute_rate: rates.perMinuteRate,
      minimum_fare: rates.minimumFare,
      cancellation_fee: rates.cancellationFee,
      is_active: true
    }));
  }

  static calculateRouteDistanceAndDuration(pickup, dropoff, stops = []) {
    let totalDistanceKm = 0;
    let currentPoint = pickup;

    // Sort stops if any
    const sortedStops = [...stops].sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0));

    for (const stop of sortedStops) {
      totalDistanceKm += calculateHaversineDistance(
        currentPoint.latitude,
        currentPoint.longitude,
        stop.latitude,
        stop.longitude
      );
      currentPoint = stop;
    }

    // From last stop (or pickup) to dropoff
    totalDistanceKm += calculateHaversineDistance(
      currentPoint.latitude,
      currentPoint.longitude,
      dropoff.latitude,
      dropoff.longitude
    );

    totalDistanceKm = Math.round(totalDistanceKm * 100) / 100;
    const durationMin = estimateDurationMinutes(totalDistanceKm);

    return { totalDistanceKm, durationMin };
  }

  static async getRoutePolyline({ pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, stops = [] }) {
    const coords = [
      [pickupLongitude, pickupLatitude],
      ...stops.map((s) => [s.longitude, s.latitude]),
      [dropoffLongitude, dropoffLatitude]
    ];

    const osrm = await getOsrmRoute(coords);
    if (osrm) return osrm;

    const { totalDistanceKm, durationMin } = this.calculateRouteDistanceAndDuration(
      { latitude: pickupLatitude, longitude: pickupLongitude },
      { latitude: dropoffLatitude, longitude: dropoffLongitude },
      stops
    );

    return {
      distanceKm: totalDistanceKm,
      durationMin,
      coordinates: [
        [pickupLatitude, pickupLongitude],
        ...stops.map((s) => [s.latitude, s.longitude]),
        [dropoffLatitude, dropoffLongitude]
      ],
      source: 'Direct_Haversine'
    };
  }

  static async estimateFares({ pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, stops = [], promoCode = null }) {
    // 1. Calculate real driving road distance and travel time using Leaflet / OSRM map engine
    const route = await this.getRoutePolyline({
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      stops
    });

    const totalDistanceKm = Number(route.distanceKm || 0);
    const durationMin = Number(route.durationMin || 0);

    const vehicleTypes = await this.getVehicleTypes();

    let promo = null;
    if (promoCode) {
      promo = await PromoService.getPromoByCode(promoCode);
    }

    // Calculate surge multiplier dynamically (e.g. baseline 1.0)
    const surgeMultiplier = 1.0;

    const estimates = vehicleTypes.map((tier) => {
      const breakdown = calculateRideFare({
        vehicleType: tier.id,
        distanceKm: totalDistanceKm,
        durationMin,
        surgeMultiplier,
        promoCode: promo,
        customRates: tier
      });

      return {
        vehicleTypeId: tier.id,
        name: tier.name,
        description: tier.description,
        capacity: tier.capacity,
        imageUrl: tier.image_url,
        distanceKm: totalDistanceKm,
        durationMin,
        surgeMultiplier,
        baseFare: breakdown.baseFare,
        distanceFare: breakdown.distanceFare,
        timeFare: breakdown.timeFare,
        subtotal: breakdown.subtotal,
        discountAmount: breakdown.discountAmount,
        finalFare: breakdown.finalFare,
        cancellationFee: breakdown.cancellationFee
      };
    });

    return {
      distanceKm: totalDistanceKm,
      durationMin,
      estimates,
      coordinates: route.coordinates,
      routingSource: route.source || 'OSRM_Leaflet_Engine',
      appliedPromo: promo ? { code: promo.code, discountPercentage: promo.discount_percentage } : null
    };
  }
}
