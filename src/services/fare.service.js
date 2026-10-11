import { supabaseAdmin, supabase } from '../config/supabase.js';
import { calculateHaversineDistance, estimateDurationMinutes } from '../utils/geoUtils.js';
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
        .from('vehicle_types')
        .select('*')
        .eq('is_active', true);

      if (!error && data && data.length > 0) {
        return data;
      }
    }

    return Object.entries(DEFAULT_VEHICLE_RATES).map(([id, rates]) => ({
      id,
      name: rates.name,
      description: `${rates.name} ride service`,
      capacity: rates.capacity,
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

  static async estimateFares({ pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, stops = [], promoCode = null }) {
    const { totalDistanceKm, durationMin } = this.calculateRouteDistanceAndDuration(
      { latitude: pickupLatitude, longitude: pickupLongitude },
      { latitude: dropoffLatitude, longitude: dropoffLongitude },
      stops
    );

    const vehicleTypes = await this.getVehicleTypes();

    let promo = null;
    if (promoCode) {
      promo = await PromoService.getPromoByCode(promoCode);
    }

    // Calculate surge multiplier dynamically (e.g. simulated baseline 1.0)
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
      appliedPromo: promo ? { code: promo.code, discountPercentage: promo.discount_percentage } : null
    };
  }
}
