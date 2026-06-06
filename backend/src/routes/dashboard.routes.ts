import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/dashboard/staff
router.get('/staff', dashboardController.getStaffDashboard);

export default router;
