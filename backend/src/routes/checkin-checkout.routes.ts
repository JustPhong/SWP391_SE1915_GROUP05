import { Router } from 'express';
import { checkInController, checkOutController } from '../controllers/checkin-checkout.controller';
import { checkInSchema, checkOutSchema } from '../dtos/checkin-checkout.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('STAFF', 'MANAGER'));
   
router.post('/in', checkInSchema, validate, checkInController.checkIn);
router.get('/active', checkInController.getActiveRecords);
router.get('/history', checkInController.getHistory);
router.get('/preview/:recordId', checkOutController.preview);
router.post('/out', checkOutSchema, validate, checkOutController.checkOut);

export default router;
