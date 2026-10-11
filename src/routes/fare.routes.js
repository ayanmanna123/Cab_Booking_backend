import { Router } from 'express';
import { FareController } from '../controllers/fare.controller.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { estimateFareSchema } from '../validations/ride.validation.js';

const router = Router();

router.get('/vehicles', FareController.getVehicleTypes);
router.post('/estimate', validateRequest(estimateFareSchema), FareController.estimateFare);
router.post('/route', validateRequest(estimateFareSchema), FareController.getRoute);

export default router;
