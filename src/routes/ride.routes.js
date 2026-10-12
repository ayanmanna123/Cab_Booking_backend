import { Router } from 'express';
import { RideController } from '../controllers/ride.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  requestRideSchema,
  estimateFareSchema,
  updateRideStatusSchema,
  cancelRideSchema,
  verifyPinSchema
} from '../validations/ride.validation.js';

const router = Router();

// Fare estimation
router.post('/estimate', validateRequest(estimateFareSchema), RideController.estimateFare);

// Ride booking
router.post('/', requireAuth, validateRequest(requestRideSchema), RideController.requestRide);
router.post('/request', requireAuth, validateRequest(requestRideSchema), RideController.requestRide);

// Active ride & History
router.get('/active', requireAuth, RideController.getActiveRide);
router.get('/history', requireAuth, RideController.getRideHistory);
router.get('/history/rider', requireAuth, RideController.getRiderHistory);
router.get('/history/driver', requireAuth, RideController.getDriverHistory);

// Specific ride actions
router.get('/:rideId', requireAuth, RideController.getRideDetails);
router.post('/:rideId/accept', requireAuth, RideController.acceptRide);
router.post('/:rideId/reject', requireAuth, RideController.rejectRide);
router.post('/:rideId/arrive', requireAuth, RideController.arriveRide);
router.post('/:rideId/verify-pin', requireAuth, validateRequest(verifyPinSchema), RideController.verifyPin);
router.post('/:rideId/complete', requireAuth, RideController.completeRide);
router.post('/:rideId/cancel', requireAuth, validateRequest(cancelRideSchema), RideController.cancelRide);
router.patch('/:rideId/status', requireAuth, validateRequest(updateRideStatusSchema), RideController.updateRideStatus);

export default router;
