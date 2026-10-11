import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createPaymentIntentSchema,
  confirmPaymentSchema
} from '../validations/payment.validation.js';

const router = Router();

router.post('/create-intent', requireAuth, validateRequest(createPaymentIntentSchema), PaymentController.createPaymentIntent);
router.post('/confirm', requireAuth, validateRequest(confirmPaymentSchema), PaymentController.confirmPayment);
router.get('/receipt/:rideId', requireAuth, PaymentController.getReceipt);

export default router;
