import { Router } from 'express';
import { slotController } from '../controllers/slot.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/available', slotController.getAvailable);
router.get('/all', slotController.getAll);

// PATCH /api/slots/:id/status — Staff/Manager/Admin cập nhật trạng thái thủ công
router.patch('/:id/status', authenticate, authorize('STAFF', 'MANAGER', 'ADMIN'), slotController.updateStatus);

export default router;   