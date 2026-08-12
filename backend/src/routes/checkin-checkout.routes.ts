import { Router } from 'express';
import { checkInController, checkOutController } from '../controllers/checkin-checkout.controller';
import { checkInSchema, checkOutSchema } from '../dtos/checkin-checkout.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';

import { uploadCheckoutImage } from '../middleware/upload.checkout.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('STAFF', 'MANAGER', 'ADMIN'));
   
router.post('/in', checkInSchema, validate, checkInController.checkIn);
router.get('/active', checkInController.getActiveRecords);
router.get('/history', checkInController.getHistory);
router.get('/history/:id', checkInController.getHistoryDetail);
router.get('/preview/:recordId', checkOutController.preview);
router.post(
  '/out',
  uploadCheckoutImage.fields([
    { name: 'frontCheckOutImage', maxCount: 1 },
    { name: 'rearCheckOutImage', maxCount: 1 },
    { name: 'driverCheckOutImage', maxCount: 1 },
  ]),
  checkOutSchema,
  validate,
  checkOutController.checkOut
);

export default router;
