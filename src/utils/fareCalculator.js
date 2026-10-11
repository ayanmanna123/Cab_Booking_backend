// Default pricing configuration if database vehicle type isn't queried
export const DEFAULT_VEHICLE_RATES = {
  economy: {
    name: 'UberX',
    baseFare: 2.50,
    perKmRate: 1.30,
    perMinuteRate: 0.25,
    minimumFare: 5.00,
    cancellationFee: 3.00,
    capacity: 4
  },
  comfort: {
    name: 'Uber Comfort',
    baseFare: 4.00,
    perKmRate: 1.75,
    perMinuteRate: 0.35,
    minimumFare: 7.50,
    cancellationFee: 4.50,
    capacity: 4
  },
  xl: {
    name: 'UberXL',
    baseFare: 5.50,
    perKmRate: 2.20,
    perMinuteRate: 0.45,
    minimumFare: 10.00,
    cancellationFee: 5.00,
    capacity: 6
  },
  black: {
    name: 'Uber Black',
    baseFare: 8.00,
    perKmRate: 3.50,
    perMinuteRate: 0.65,
    minimumFare: 15.00,
    cancellationFee: 8.00,
    capacity: 4
  }
};

/**
 * Calculates estimated and final ride fares
 * @param {Object} params
 * @param {string} params.vehicleType - 'economy' | 'comfort' | 'xl' | 'black'
 * @param {number} params.distanceKm
 * @param {number} params.durationMin
 * @param {number} params.surgeMultiplier - e.g. 1.0 to 2.5
 * @param {Object} params.promoCode - Optional promo code object with discount details
 * @param {Object} params.customRates - Optional rate override from DB
 * @returns {Object} fare breakdown
 */
export function calculateRideFare({
  vehicleType = 'economy',
  distanceKm = 0,
  durationMin = 0,
  surgeMultiplier = 1.0,
  promoCode = null,
  customRates = null
}) {
  const rates = customRates || DEFAULT_VEHICLE_RATES[vehicleType] || DEFAULT_VEHICLE_RATES.economy;

  const baseFare = Number(rates.baseFare || rates.base_fare || 2.5);
  const perKmRate = Number(rates.perKmRate || rates.per_km_rate || 1.3);
  const perMinuteRate = Number(rates.perMinuteRate || rates.per_minute_rate || 0.25);
  const minimumFare = Number(rates.minimumFare || rates.minimum_fare || 5.0);
  const cancellationFee = Number(rates.cancellationFee || rates.cancellation_fee || 3.0);

  const distanceFare = distanceKm * perKmRate;
  const timeFare = durationMin * perMinuteRate;

  const subtotalBeforeSurge = baseFare + distanceFare + timeFare;
  const surgeFare = subtotalBeforeSurge * (Math.max(1.0, surgeMultiplier) - 1.0);
  const grossFare = Math.max(minimumFare, subtotalBeforeSurge + surgeFare);

  let discountAmount = 0;
  if (promoCode && promoCode.is_active) {
    if (grossFare >= Number(promoCode.min_ride_fare || 0)) {
      const calculatedDiscount = (grossFare * Number(promoCode.discount_percentage)) / 100;
      discountAmount = Math.min(calculatedDiscount, Number(promoCode.max_discount_amount || calculatedDiscount));
    }
  }

  const netFare = Math.max(minimumFare, grossFare - discountAmount);

  // Platform cut 20%, driver earnings 80%
  const platformFee = Math.round(netFare * 0.20 * 100) / 100;
  const driverEarnings = Math.round((netFare - platformFee) * 100) / 100;

  return {
    vehicleType,
    vehicleName: rates.name,
    capacity: rates.capacity,
    baseFare: Math.round(baseFare * 100) / 100,
    distanceFare: Math.round(distanceFare * 100) / 100,
    timeFare: Math.round(timeFare * 100) / 100,
    surgeMultiplier: Number(surgeMultiplier.toFixed(2)),
    subtotal: Math.round(grossFare * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalFare: Math.round(netFare * 100) / 100,
    platformFee,
    driverEarnings,
    cancellationFee
  };
}
