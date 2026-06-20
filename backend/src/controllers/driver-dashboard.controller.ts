import { Response } from 'express';
import { asyncHandler } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth.middleware';
import { driverDashboardService } from '../services/driver-dashboard.service';

export const driverDashboardController = {
  getCurrentSession: asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await driverDashboardService.getCurrentSession(req.user!.id);
    return res.status(200).json({ success: true, data });
  }),

  getMyPackage: asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await driverDashboardService.getMyPackage(req.user!.id);
    return res.status(200).json({ success: true, data });
  }),

  getHistory: asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await driverDashboardService.getHistory(req.user!.id);
    return res.status(200).json({ success: true, data });
  }),
};
  