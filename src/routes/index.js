import { Router } from 'express';
import authRoutes from './auth.routes.js';
import driverRoutes from './driver.routes.js';
import fareRoutes from './fare.routes.js';
import rideRoutes from './ride.routes.js';
import paymentRoutes from './payment.routes.js';
import reviewRoutes from './review.routes.js';
import promoRoutes from './promo.routes.js';
import sosRoutes from './sos.routes.js';
import supportRoutes from './support.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Veyro Mobility REST API',
    version: '1.0.0'
  });
});

// Mount module routes
router.use('/auth', authRoutes);
router.use('/drivers', driverRoutes);
router.use('/fares', fareRoutes);
router.use('/rides', rideRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/promos', promoRoutes);
router.use('/sos', sosRoutes);
router.use('/support', supportRoutes);

export default router;
