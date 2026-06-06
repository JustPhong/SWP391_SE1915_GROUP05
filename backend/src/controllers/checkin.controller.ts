import { Response } from 'express';
import { checkinService } from '../services/checkin.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const checkinController = {
  // GET /api/checkin/lookup/:plate
  lookup: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate } = req.params;
    const result = await checkinService.lookupPlate(plate);
    return res.status(200).json({ success: true, data: result });
  }),

  // GET /api/checkin/stats
  stats: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const result = await checkinService.getStats();
    return res.status(200).json({ success: true, data: result });
  }),

  // POST /api/checkin
  submit: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate, vehicleType, customerType, slotCode, isMonthly } = req.body;
    const result = await checkinService.submit({
      plate,
      vehicleType,
      customerType,
      slotCode,
      isMonthly,
    });
    return res.status(201).json({ success: true, data: result });
  }),
};
