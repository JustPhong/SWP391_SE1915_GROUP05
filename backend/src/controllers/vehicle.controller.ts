import { Response } from 'express';
import { vehicleService } from '../services/vehicle.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const vehicleController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = {
      plateNumber: req.body.plateNumber,
      type: req.body.type,
      isMonthly: req.body.isMonthly,
      brand: req.body.brand,
      model: req.body.model,
      color: req.body.color,
      year: req.body.year,
      seats: req.body.seats,
      ownerId: req.user!.id,
    };
    const vehicle = await vehicleService.create(payload);
    return res.status(201).json({ success: true, data: vehicle });
  }),
  
  getByPlate: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicle = await vehicleService.getByPlate(req.params.plateNumber);
    return res.status(200).json({ success: true, data: vehicle });
  }),

  getMyVehicles: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicles = await vehicleService.getByOwner(req.user!.id);
    return res.status(200).json({ success: true, data: vehicles });
  }),

  getDetail: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicle = await vehicleService.getDetail(req.params.id, req.user!.id);
    return res.status(200).json({ success: true, data: vehicle });
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicle = await vehicleService.update(req.params.id, req.user!.id, req.body);
    return res.status(200).json({ success: true, data: vehicle });
  }),

  remove: asyncHandler(async (req: AuthRequest, res: Response) => {
    await vehicleService.remove(req.params.id, req.user!.id);
    return res.status(204).send();
  }),
};
