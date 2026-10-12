import crypto from 'crypto';
import { stripe } from '../config/stripe.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';
import { PAYMENT_STATUS, DB_TABLES } from '../config/constants.js';
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
        .from(DB_TABLES.RIDES)
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
          currency: 'inr',
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
      currency: 'INR',
      payment_method: paymentMethod,
      status: PAYMENT_STATUS.PENDING,
      stripe_payment_intent_id: paymentIntentId,
      platform_fee: platformFee,
      driver_earnings: driverEarnings,
      created_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from(DB_TABLES.PAYMENTS)
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
    let receiptUrl = `https://dashboard.stripe.com/test/payments/${paymentIntentId}`;

    if (stripe && paymentIntentId && paymentIntentId.startsWith('pi_')) {
      try {
        let pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation') {
          pi = await stripe.paymentIntents.confirm(paymentIntentId, {
            payment_method: 'pm_card_visa',
            return_url: 'http://localhost:5173'
          });
        }
        if (pi?.charges?.data?.[0]?.receipt_url) {
          receiptUrl = pi.charges.data[0].receipt_url;
        }
      } catch (stripeErr) {
        logger.warn('Stripe confirm call note:', stripeErr.message);
      }
    }

    const updates = {
      status: PAYMENT_STATUS.SUCCEEDED,
      receipt_url: receiptUrl,
      updated_at: new Date().toISOString()
    };

    if (client) {
      try {
        let query = client.from(DB_TABLES.PAYMENTS).update(updates);
        if (paymentIntentId) {
          query = query.eq('stripe_payment_intent_id', paymentIntentId);
        } else {
          query = query.eq('ride_id', rideId);
        }
        const { data, error } = await query.select();

        if (error) {
          logger.warn('Supabase payments update warning:', error.message);
        } else if (data && data.length > 0) {
          // Sync payment status to rides table
          await client
            .from(DB_TABLES.RIDES)
            .update({ payment_status: 'PAID' })
            .eq('id', rideId);

          return data[0];
        }
      } catch (err) {
        logger.warn('Supabase payments confirmation error:', err.message);
      }
    }

    for (const payment of memoryPayments.values()) {
      if (payment.ride_id === rideId || payment.stripe_payment_intent_id === paymentIntentId) {
        Object.assign(payment, updates);
        return payment;
      }
    }

    return {
      ride_id: rideId,
      stripe_payment_intent_id: paymentIntentId,
      ...updates
    };
  }

  static async getRideReceipt(rideId) {
    const client = this.getClient();
    if (client) {
      const { data: ride } = await client
        .from(DB_TABLES.RIDES)
        .select(`
          *,
          rider:${DB_TABLES.USERS}!cb_rides_rider_id_fkey(full_name, email),
          driver:${DB_TABLES.DRIVER_PROFILES}!cb_rides_driver_id_fkey(
            vehicle_make, vehicle_model, license_plate,
            driver_user:${DB_TABLES.USERS}(full_name)
          ),
          ${DB_TABLES.PAYMENTS}(*),
          ${DB_TABLES.VEHICLE_TYPES}(name)
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
