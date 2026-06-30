import { Router } from 'express';
import { publicController } from '../controllers/public.controller';

const router = Router();

/**
 * GET /public/availability
 *
 * Public endpoint (no auth). Returns live parking availability grouped by
 * zone (CASUAL / MONTHLY) and vehicle type (CAR / MOTORBIKE).
 */
router.get('/availability', publicController.getAvailability);

export default router;
