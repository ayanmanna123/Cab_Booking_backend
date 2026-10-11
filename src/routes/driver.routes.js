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
router.patch('/location', requireAuth, validateRequest(updateDriverLocationSchema), DriverController.updateLocation);
router.patch('/status', requireAuth, validateRequest(toggleDriverStatusSchema), DriverController.toggleOnlineStatus);
router.get('/nearby', validateRequest(getNearbyDriversSchema, 'query'), DriverController.getNearbyDrivers);
router.get('/dashboard', requireAuth, DriverController.getDashboard);

export default router;
