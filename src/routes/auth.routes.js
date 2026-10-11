import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { syncUserSchema, updateProfileSchema } from '../validations/auth.validation.js';
import { authRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

router.post('/sync', authRateLimiter, validateRequest(syncUserSchema), AuthController.syncUser);
router.get('/me', requireAuth, AuthController.getMe);
router.patch('/profile', requireAuth, validateRequest(updateProfileSchema), AuthController.updateProfile);

export default router;
