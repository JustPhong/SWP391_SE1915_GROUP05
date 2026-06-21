import { Router } from 'express';
import { parkingOverviewController } from '../controllers/parking-overview.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', parkingOverviewController.getOverview);

export default router;
  