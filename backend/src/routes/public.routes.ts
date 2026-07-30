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

// Public guest vehicle tracking & prepayment routes
router.post('/guest/lookup', publicController.lookupGuestVehicle);
router.post('/guest/stripe-session', publicController.createGuestStripeSession);
router.get('/guest/stripe-status', publicController.getGuestStripeStatus);

export default router;
