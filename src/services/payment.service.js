import crypto from 'crypto';
import { stripe } from '../config/stripe.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { PAYMENT_STATUS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const memoryPayments = new Map();

export class PaymentService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async createPaymentIntent({ rideId, riderId, paymentMethod = 'stripe' }) {
    const client = this.getClient();
    let ride = null;

    if (client) {
      const { data, error } = await client
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();
      if (error) throw new Error(error.message);
      ride = data;
    }

    const fareAmount = Number(ride?.final_fare || ride?.estimated_fare || 25.00);
    const amountInCents = Math.round(fareAmount * 100);

    const platformFee = Math.round(fareAmount * 0.20 * 100) / 100;
    const driverEarnings = Math.round((fareAmount - platformFee) * 100) / 100;

    let clientSecret = 'pi_test_mock_secret_' + Math.random().toString(36).substring(7);
    let paymentIntentId = 'pi_' + Math.random().toString(36).substring(7);

    // If live Stripe SDK is initialized with secret key
    if (stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            rideId,
            riderId,
            driverId: ride?.driver_id || ''
          }
        });
        clientSecret = paymentIntent.client_secret;
        paymentIntentId = paymentIntent.id;
      } catch (stripeErr) {
        logger.warn('Stripe SDK error, generating fallback intent:', stripeErr.message);
      }
    }

    const paymentRecord = {
      ride_id: rideId,
      rider_id: riderId,
      driver_id: ride?.driver_id || null,
      amount: fareAmount,
      currency: 'USD',
      payment_method: paymentMethod,
      status: PAYMENT_STATUS.PENDING,
      stripe_payment_intent_id: paymentIntentId,
      platform_fee: platformFee,
      driver_earnings: driverEarnings,
      created_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from('payments')
        .insert(paymentRecord)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return {
        payment: data,
        clientSecret,
        paymentIntentId
      };
    }

    const id = crypto.randomUUID();
    const saved = { id, ...paymentRecord };
    memoryPayments.set(id, saved);

    return {
      payment: saved,
      clientSecret,
      paymentIntentId
    };
  }

  static async confirmPayment({ rideId, paymentIntentId }) {
    const client = this.getClient();
    const updates = {
      status: PAYMENT_STATUS.SUCCEEDED,
      receipt_url: `https://pay.stripe.com/receipts/mock_${paymentIntentId}`,
      updated_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from('payments')
        .update(updates)
        .eq('ride_id', rideId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    for (const payment of memoryPayments.values()) {
      if (payment.ride_id === rideId) {
        Object.assign(payment, updates);
        return payment;
      }
    }

    return null;
  }

  static async getRideReceipt(rideId) {
    const client = this.getClient();
    if (client) {
      const { data: ride } = await client
        .from('rides')
        .select(`
          *,
          rider:users!rides_rider_id_fkey(full_name, email),
          driver:driver_profiles!rides_driver_id_fkey(
            vehicle_make, vehicle_model, license_plate,
            driver_user:users(full_name)
          ),
          payments(*),
          vehicle_types(name)
        `)
        .eq('id', rideId)
        .single();

      if (ride) {
        return {
          receiptNumber: `UBER-${ride.id.substring(0, 8).toUpperCase()}`,
          date: ride.completed_at || ride.created_at,
          riderName: ride.rider?.full_name,
          riderEmail: ride.rider?.email,
          driverName: ride.driver?.driver_user?.full_name || 'Assigned Driver',
          vehicle: `${ride.driver?.vehicle_make || ''} ${ride.driver?.vehicle_model || ''} (${ride.driver?.license_plate || ''})`,
          pickupAddress: ride.pickup_address,
          dropoffAddress: ride.dropoff_address,
          distanceKm: ride.distance_km,
          durationMin: ride.duration_min,
          baseFare: ride.base_fare,
          distanceFare: ride.distance_fare,
          timeFare: ride.time_fare,
          surgeMultiplier: ride.surge_multiplier,
          discountAmount: ride.discount_amount,
          totalCharged: ride.final_fare || ride.estimated_fare,
          paymentMethod: ride.payments?.[0]?.payment_method || 'stripe',
          paymentStatus: ride.payments?.[0]?.status || 'SUCCEEDED'
        };
      }
    }

    return null;
  }
}
