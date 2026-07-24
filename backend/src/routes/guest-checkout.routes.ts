import { Router } from 'express';
import { GuestCheckoutController } from '../controllers/guest-checkout.controller';

const router = Router();

/**
 * Public guest self-checkout routes (no authentication required)
 */

// GET /api/public/guest-checkout/:code
// Lookup parking record by 6-digit guest code
router.get('/:code', GuestCheckoutController.lookup);

// POST /api/public/guest-checkout/:code/prepay
// Pay now and get 15-minute grace period
router.post('/:code/prepay', GuestCheckoutController.prepay);

// POST /api/public/guest-checkout/:code/pay-overstay
// Pay overstay fee after grace period expires
router.post('/:code/pay-overstay', GuestCheckoutController.payOverstay);

// POST /api/public/guest-checkout/:code/confirm-exit
// Confirm vehicle has exited
router.post('/:code/confirm-exit', GuestCheckoutController.confirmExit);

export default router;