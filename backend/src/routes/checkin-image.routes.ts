import { Router } from 'express';
import { checkinImageController } from '../controllers/checkin-image.controller';
import { ocrController } from '../controllers/ocr.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { uploadCheckinImage } from '../middleware/upload.checkin.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('STAFF', 'MANAGER', 'ADMIN'));

router.post('/upload-image', uploadCheckinImage.single('image'), checkinImageController.upload);
router.post('/ocr', uploadCheckinImage.single('image'), ocrController.performOcr);
router.post('/delete-images', checkinImageController.deleteImages);

export default router;