import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);

router.get('/lookup', checkoutController.lookup);
router.get('/lookup/:plate', checkoutController.lookup);
router.get('/parked', checkoutController.parked);
router.post('/', checkoutController.submit);
router.post('/lost-ticket', checkoutController.lostTicket);
router.post('/calculate-fee/:ticketId', checkoutController.calculateFee);
router.post('/complete/:ticketId', checkoutController.complete);
router.post('/:ticketId/photos', checkoutController.uploadPhotos);

export default router;
