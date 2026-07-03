import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// DRIVER and other roles can fetch the bank config to make payments
router.get('/vietqr-config', paymentController.getVietQRConfig);

router.use(authorize('STAFF', 'MANAGER', 'ADMIN'));

router.post('/', paymentController.recordPayment);
router.get('/', paymentController.getPayments);

export default router;
