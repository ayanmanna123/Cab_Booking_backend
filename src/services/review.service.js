import crypto from 'crypto';
import { supabaseAdmin, supabase } from '../config/supabase.js';

const memoryReviews = new Map();

export class ReviewService {
  static getClient() {
    return supabaseAdmin || supabase;
  }

  static async createReview({ rideId, reviewerId, rating, comment = '' }) {
    const client = this.getClient();
    let ride = null;

    if (client) {
      const { data } = await client.from('rides').select('*, driver_profiles(*)').eq('id', rideId).single();
      ride = data;
    }

    // Determine reviewee (if reviewer is rider, reviewee is driver's user account, and vice-versa)
    const revieweeId = ride?.rider_id === reviewerId ? ride?.driver_profiles?.user_id || ride?.driver_id : ride?.rider_id;

    const payload = {
      ride_id: rideId,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId || reviewerId,
      rating,
      comment: comment || null,
      created_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client.from('reviews').insert(payload).select().single();
      if (error) throw new Error(error.message);

      // Recalculate average rating for driver profile if applicable
      if (ride?.driver_id) {
        const { data: allReviews } = await client
          .from('reviews')
          .select('rating')
          .eq('reviewee_id', revieweeId);

        if (allReviews && allReviews.length > 0) {
          const avg = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
          const roundedAvg = Math.round(avg * 100) / 100;
          await client
            .from('driver_profiles')
            .update({ rating: roundedAvg })
            .eq('id', ride.driver_id);
        }
      }

      return data;
    }

    const id = crypto.randomUUID();
    const saved = { id, ...payload };
    memoryReviews.set(id, saved);
    return saved;
  }

  static async getReviewsForUser(userId) {
    const client = this.getClient();
    if (client) {
      const { data, error } = await client
        .from('reviews')
        .select('*, reviewer:users!reviews_reviewer_id_fkey(full_name, avatar_url)')
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    }

    return Array.from(memoryReviews.values()).filter((r) => r.reviewee_id === userId);
  }
}
