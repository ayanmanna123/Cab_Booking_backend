import { ReviewService } from '../services/review.service.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class ReviewController {
  static async createReview(req, res, next) {
    try {
      const review = await ReviewService.createReview({
        ...req.body,
        reviewerId: req.user.id
      });
      return ApiResponse.created(res, review, 'Review and rating submitted successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getUserReviews(req, res, next) {
    try {
      const userId = req.params.userId || req.user.id;
      const reviews = await ReviewService.getReviewsForUser(userId);
      return ApiResponse.success(res, reviews, 'Reviews fetched');
    } catch (err) {
      next(err);
    }
  }
}
