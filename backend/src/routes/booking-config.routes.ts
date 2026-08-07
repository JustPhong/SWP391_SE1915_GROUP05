import { Router } from 'express';
import { bookingConfigController } from '../controllers/booking-config.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Customer-readable endpoint: GET /booking-config
router.get('/', authenticate, bookingConfigController.get);

export default router;
