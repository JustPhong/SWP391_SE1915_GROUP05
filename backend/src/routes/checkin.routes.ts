import { Router } from 'express';
import { checkinController } from '../controllers/checkin.controller';
import { slotController } from '../controllers/slot.controller';
import { submitCheckinSchema } from '../dtos/checkin.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
   
// GET /api/checkin/lookup/:plate
router.get('/lookup/:plate', checkinController.lookup);

// GET /api/checkin/stats
router.get('/stats', checkinController.stats);

// POST /api/checkin
router.post('/', submitCheckinSchema, validate, requirePermission('checkin.create'), checkinController.submit);

export default router;
