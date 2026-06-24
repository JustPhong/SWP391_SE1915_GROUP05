import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);

router.get('/lookup/:plate', checkoutController.lookup);
router.get('/parked', checkoutController.parked);
router.post('/', requirePermission('checkout.create'), checkoutController.submit);
router.post('/lost-ticket', requirePermission('checkout.lost_ticket'), checkoutController.lostTicket);

export default router;