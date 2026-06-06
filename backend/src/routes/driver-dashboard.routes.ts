import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { driverDashboardController } from '../controllers/driver-dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/sessions/current', driverDashboardController.getCurrentSession);
router.get('/packages/my', driverDashboardController.getMyPackage);
router.get('/history', driverDashboardController.getHistory);

export default router;
