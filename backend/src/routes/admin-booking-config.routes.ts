import { Router } from 'express';
import { bookingConfigController } from '../controllers/booking-config.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Admin-only patch endpoint: PATCH /admin/booking-config
router.patch('/', authenticate, authorize('ADMIN'), requirePermission('fee_rule.manage'), bookingConfigController.update);

export default router;
