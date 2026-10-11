import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';

const memoryPromos = new Map([
  [
    'WELCOME50',
    {
      id: 'promo-welcome50',
      code: 'WELCOME50',
      description: '50% off on your first ride up to $10',
      discount_percentage: 50.0,
      max_discount_amount: 10.0,
      min_ride_fare: 5.0,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true
    }
  ],
  [
    'UBER20',
    {
      id: 'promo-uber20',
      code: 'UBER20',
      description: '20% off weekend ride',
      discount_percentage: 20.0,
      max_discount_amount: 15.0,
      min_ride_fare: 10.0,
      valid_until: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true
    }
  ]
]);

export class PromoService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async getPromoByCode(code) {
    const cleanCode = code.trim().toUpperCase();
    const client = this.getClient();

    if (client) {
      const { data, error } = await client
        .from('promo_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) return data;
    }

    return memoryPromos.get(cleanCode) || null;
  }

  static async validatePromo(code, rideFare) {
    const promo = await this.getPromoByCode(code);

    if (!promo) {
      return { valid: false, message: 'Invalid or expired promo code' };
    }

    if (new Date(promo.valid_until) < new Date()) {
      return { valid: false, message: 'Promo code has expired' };
    }

    if (Number(rideFare) < Number(promo.min_ride_fare)) {
      return {
        valid: false,
        message: `Ride fare must be at least $${promo.min_ride_fare} to use this promo code`
      };
    }

    const calculatedDiscount = (Number(rideFare) * Number(promo.discount_percentage)) / 100;
    const discountAmount = Math.min(
      calculatedDiscount,
      Number(promo.max_discount_amount || calculatedDiscount)
    );

    return {
      valid: true,
      promo,
      discountAmount: Math.round(discountAmount * 100) / 100,
      newFare: Math.max(0, Math.round((Number(rideFare) - discountAmount) * 100) / 100)
    };
  }

  static async createPromo(promoData) {
    const client = this.getClient();
    const cleanCode = promoData.code.trim().toUpperCase();

    const payload = {
      code: cleanCode,
      description: promoData.description || null,
      discount_percentage: promoData.discountPercentage,
      max_discount_amount: promoData.maxDiscountAmount,
      min_ride_fare: promoData.minRideFare,
      valid_until: promoData.validUntil,
      usage_limit: promoData.usageLimit,
      is_active: true
    };

    if (client) {
      const { data, error } = await client.from('promo_codes').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data;
    }

    const saved = { id: crypto.randomUUID(), ...payload, times_used: 0 };
    memoryPromos.set(cleanCode, saved);
    return saved;
  }
}
