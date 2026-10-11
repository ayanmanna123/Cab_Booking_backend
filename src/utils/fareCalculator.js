// Default pricing configuration in Indian Rupees (INR ₹)
export const DEFAULT_VEHICLE_RATES = {
  uber_go_ac: {
    name: 'Uber Go AC',
    description: 'Affordable compact AC rides',
    baseFare: 50.00,
    perKmRate: 14.00,
    perMinuteRate: 1.50,
    minimumFare: 70.00,
    cancellationFee: 30.00,
    capacity: 4,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/HatchbackMini-Snowflake-520.png'
  },
  bike: {
    name: 'Bike',
    description: 'Affordable 2 wheeler rides',
    baseFare: 25.00,
    perKmRate: 7.50,
    perMinuteRate: 0.80,
    minimumFare: 35.00,
    cancellationFee: 15.00,
    capacity: 1,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MotorcycleOrange-249-0.png'
  },
  go_non_ac: {
    name: 'Go Non AC',
    description: 'Everyday affordable rides',
    baseFare: 45.00,
    perKmRate: 12.50,
    perMinuteRate: 1.20,
    minimumFare: 60.00,
    cancellationFee: 25.00,
    capacity: 4,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/HatchbackMini-433-0.png'
  },
  uber_xl: {
    name: 'UberXL',
    description: 'Affordable rides for groups up to 6',
    baseFare: 110.00,
    perKmRate: 22.00,
    perMinuteRate: 2.20,
    minimumFare: 150.00,
    cancellationFee: 50.00,
    capacity: 6,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MinivanLuggage-169-0.png'
  },
  go_priority: {
    name: 'Go Priority',
    description: 'Priority pickup',
    baseFare: 60.00,
    perKmRate: 16.00,
    perMinuteRate: 1.60,
    minimumFare: 85.00,
    cancellationFee: 35.00,
    capacity: 4,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/HatchbackMini-Lightning-435-0.png'
  },
  premier_ac: {
    name: 'Premier AC',
    description: 'Comfortable sedans, top-quality drivers',
    baseFare: 75.00,
    perKmRate: 18.00,
    perMinuteRate: 1.80,
    minimumFare: 100.00,
    cancellationFee: 45.00,
    capacity: 4,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/SedanComfort-Sparkles-523.png'
  },
  parcel_bike: {
    name: 'Parcel Bike',
    description: 'Send packages up to 20 kg',
    baseFare: 30.00,
    perKmRate: 8.00,
    perMinuteRate: 0.90,
    minimumFare: 40.00,
    cancellationFee: 15.00,
    capacity: 1,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MotorcycleCourier-037-0.png'
  },
  parcel_scooter: {
    name: 'Parcel Scooter',
    description: 'Send packages up to 25 kg',
    baseFare: 35.00,
    perKmRate: 8.50,
    perMinuteRate: 1.00,
    minimumFare: 45.00,
    cancellationFee: 15.00,
    capacity: 1,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/VespaCourier-298-0.png'
  },
  premier_xl: {
    name: 'Premier XL',
    description: 'Newer XL cars with top-rated drivers',
    baseFare: 130.00,
    perKmRate: 25.00,
    perMinuteRate: 2.50,
    minimumFare: 180.00,
    cancellationFee: 60.00,
    capacity: 6,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/Minivan-DiamondSparklesNew-529.png'
  },
  bike_saver: {
    name: 'Bike Saver',
    description: 'Save more when not in rush',
    baseFare: 20.00,
    perKmRate: 7.00,
    perMinuteRate: 0.70,
    minimumFare: 30.00,
    cancellationFee: 15.00,
    capacity: 1,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MotorcycleOrange-Clock-333-0.png'
  },
  economy: {
    name: 'Uber Go AC',
    description: 'Affordable compact AC rides',
    baseFare: 50.00,
    perKmRate: 14.00,
    perMinuteRate: 1.50,
    minimumFare: 70.00,
    cancellationFee: 30.00,
    capacity: 4,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/HatchbackMini-Snowflake-520.png'
  },
  comfort: {
    name: 'Premier AC',
    description: 'Comfortable sedans, top-quality drivers',
    baseFare: 75.00,
    perKmRate: 18.00,
    perMinuteRate: 1.80,
    minimumFare: 100.00,
    cancellationFee: 45.00,
    capacity: 4,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/SedanComfort-Sparkles-523.png'
  },
  xl: {
    name: 'UberXL',
    description: 'Affordable rides for groups up to 6',
    baseFare: 110.00,
    perKmRate: 22.00,
    perMinuteRate: 2.20,
    minimumFare: 150.00,
    cancellationFee: 50.00,
    capacity: 6,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MinivanLuggage-169-0.png'
  },
  black: {
    name: 'Premier XL',
    description: 'Newer XL cars with top-rated drivers',
    baseFare: 130.00,
    perKmRate: 25.00,
    perMinuteRate: 2.50,
    minimumFare: 180.00,
    cancellationFee: 60.00,
    capacity: 6,
    imageUrl: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/Minivan-DiamondSparklesNew-529.png'
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
