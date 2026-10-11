import { Router } from 'express';
import { RideController } from '../controllers/ride.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  requestRideSchema,
  updateRideStatusSchema,
  cancelRideSchema
} from '../validations/ride.validation.js';

const router = Router();

router.post('/request', requireAuth, validateRequest(requestRideSchema), RideController.requestRide);
router.get('/active', requireAuth, RideController.getActiveRide);
router.get('/history/rider', requireAuth, RideController.getRiderHistory);
router.get('/history/driver', requireAuth, RideController.getDriverHistory);
router.get('/:rideId', requireAuth, RideController.getRideDetails);
router.post('/:rideId/accept', requireAuth, RideController.acceptRide);
router.patch('/:rideId/status', requireAuth, validateRequest(updateRideStatusSchema), RideController.updateRideStatus);
router.post('/:rideId/cancel', requireAuth, validateRequest(cancelRideSchema), RideController.cancelRide);

export default router;
