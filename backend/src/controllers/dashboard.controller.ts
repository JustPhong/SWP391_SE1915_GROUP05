import { Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const dashboardController = {
  // GET /api/dashboard/staff
  getStaffDashboard: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const data = await dashboardService.getStaffDashboard();
    return res.status(200).json({ success: true, data });
  }),
};
   