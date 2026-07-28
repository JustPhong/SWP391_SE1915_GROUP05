import { Router } from 'express';
import { publicController } from '../controllers/public.controller';

const router = Router();

// GET /api/public/vietqr-config — bank config for guest payment (no auth)
router.get('/vietqr-config', publicController.getVietQRConfig);

// GET /api/public/availability — live parking availability (no auth)
router.get('/availability', publicController.getAvailability);

// GET /api/public/guest-lookup/:plate — lookup plate for guest self-service (no auth)
router.get('/guest-lookup/:plate', publicController.guestLookup);

// POST /api/public/guest-checkin — walk-in guest check-in without account (no auth)
router.post('/guest-checkin', publicController.guestCheckin);

// POST /api/public/guest-checkout — walk-in guest checkout fee preview (no auth)
router.post('/guest-checkout', publicController.guestCheckout);

export default router;
