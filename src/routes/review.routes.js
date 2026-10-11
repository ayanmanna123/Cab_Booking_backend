import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createReviewSchema } from '../validations/review.validation.js';

const router = Router();

router.post('/', requireAuth, validateRequest(createReviewSchema), ReviewController.createReview);
router.get('/user/:userId?', requireAuth, ReviewController.getUserReviews);

export default router;
