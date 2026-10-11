import { Router } from 'express';
import { SosController } from '../controllers/sos.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { triggerSosSchema, resolveSosSchema } from '../validations/sos.validation.js';

const router = Router();

router.post('/trigger', requireAuth, validateRequest(triggerSosSchema), SosController.triggerSos);
router.post('/resolve', requireAuth, requireRole('admin'), validateRequest(resolveSosSchema), SosController.resolveSos);
router.get('/active', requireAuth, requireRole('admin'), SosController.getActiveAlerts);

export default router;
