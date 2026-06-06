import { Response } from 'express';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const monthlyPackageController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.create({
      ...req.body,
      startDate: new Date(req.body.startDate),
      expiryDate: new Date(req.body.expiryDate),
    });
    return res.status(201).json({ success: true, data: pkg });
  }),

  getActivePackages: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const packages = await monthlyPackageService.getActivePackages();
    return res.status(200).json({ success: true, data: packages });
  }),

  getMyPackages: asyncHandler(async (req: AuthRequest, res: Response) => {
    const packages = await monthlyPackageService.getByUser(req.user!.id);
    return res.status(200).json({ success: true, data: packages });
  }),

  getByVehicle: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.getByVehicle(req.params.vehicleId);
    return res.status(200).json({ success: true, data: pkg });
  }),
};
