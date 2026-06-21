import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('STAFF', 'MANAGER', 'ADMIN'));

router.post('/', paymentController.recordPayment);
router.get('/', paymentController.getPayments);

export default router;
   