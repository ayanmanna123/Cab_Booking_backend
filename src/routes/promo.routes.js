import { Router } from 'express';
import { PromoController } from '../controllers/promo.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { validatePromoSchema, createPromoSchema } from '../validations/promo.validation.js';

const router = Router();

router.post('/validate', validateRequest(validatePromoSchema), PromoController.validatePromo);
router.post('/', requireAuth, requireRole('admin'), validateRequest(createPromoSchema), PromoController.createPromo);

export default router;
