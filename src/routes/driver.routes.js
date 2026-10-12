import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  registerDriverSchema,
  updateDriverLocationSchema,
  toggleDriverStatusSchema,
  getNearbyDriversSchema
} from '../validations/driver.validation.js';

const router = Router();

router.post('/register', requireAuth, validateRequest(registerDriverSchema), DriverController.registerDriver);
router.get('/me', requireAuth, DriverController.getMyProfile);

// Driver availability status routes
router.patch('/availability', requireAuth, DriverController.toggleOnlineStatus);
router.patch('/status', requireAuth, DriverController.toggleOnlineStatus);
router.put('/status', requireAuth, DriverController.toggleOnlineStatus);
router.put('/:driverId/status', requireAuth, DriverController.toggleOnlineStatus);

// Driver location routes
router.patch('/location', requireAuth, validateRequest(updateDriverLocationSchema), DriverController.updateLocation);
router.put('/location', requireAuth, validateRequest(updateDriverLocationSchema), DriverController.updateLocation);
router.put('/:driverId/location', requireAuth, validateRequest(updateDriverLocationSchema), DriverController.updateLocation);

// Respond to incoming ride offers
router.post('/rides/:rideId/respond', requireAuth, DriverController.respondToRide);

// Discovery & Dashboard
router.get('/nearby', validateRequest(getNearbyDriversSchema, 'query'), DriverController.getNearbyDrivers);
router.get('/dashboard', requireAuth, DriverController.getDashboard);
router.post('/upload-car-image', requireAuth, DriverController.uploadCarImage);

export default router;
