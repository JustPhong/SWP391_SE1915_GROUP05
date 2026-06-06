import { Router } from 'express';
import { slotController } from '../controllers/slot.controller';

const router = Router();

router.get('/available', slotController.getAvailable);
router.get('/all', slotController.getAll);

export default router;
