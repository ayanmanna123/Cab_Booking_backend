import Stripe from 'stripe';
import { ENV } from './env.js';

let stripeClient = null;

if (ENV.STRIPE_SECRET_KEY && !ENV.STRIPE_SECRET_KEY.includes('placeholder')) {
  try {
    stripeClient = new Stripe(ENV.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });
    console.log('✅ Stripe SDK initialized successfully.');
  } catch (err) {
    console.warn('⚠️ Stripe initialization warning:', err.message);
  }
} else {
  console.warn('ℹ️ Running in Stripe Mock/Test mode. Provide valid STRIPE_SECRET_KEY in .env for live payment charges.');
}

export const stripe = stripeClient;
