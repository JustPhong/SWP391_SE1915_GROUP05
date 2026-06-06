import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller';

const router = Router();

// GET /api/checkout/lookup/:plate
router.get('/lookup/:plate', checkoutController.lookup);

// GET /api/checkout/parked
router.get('/parked', checkoutController.parked);

// POST /api/checkout
router.post('/', checkoutController.submit);

export default router;
