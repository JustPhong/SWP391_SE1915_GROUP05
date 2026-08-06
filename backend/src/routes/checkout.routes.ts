import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('STAFF', 'MANAGER', 'ADMIN'));

router.get('/lookup', checkoutController.lookup);
router.get('/lookup/:plate', checkoutController.lookup);
router.post('/lookup-by-pin', checkoutController.lookupByPin);
router.get('/parked', checkoutController.parked);
router.get('/stripe-status', requirePermission('checkout.process'), checkoutController.getStripeStatusBySession);
router.post('/', requirePermission('checkout.process'), checkoutController.submit);
router.post('/:checkInRecordId/stripe-session', requirePermission('checkout.process'), checkoutController.createStripeSession);
router.get('/:checkInRecordId/stripe-status', requirePermission('checkout.process'), checkoutController.getStripeStatus);

export default router;
