import { Response } from 'express';
import { checkoutService } from '../services/checkout.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const checkoutController = {
  // GET /api/checkout/lookup/:plate
  lookup: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate } = req.params;
    const result = await checkoutService.lookupPlate(plate);
    return res.status(200).json({ success: true, data: result });
  }),

  // GET /api/checkout/parked
  parked: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const result = await checkoutService.getParkedVehicles();
    return res.status(200).json({ success: true, data: result });
  }),

  // POST /api/checkout
  submit: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plate, method } = req.body as { plate?: string; method?: 'CASH' | 'CARD' | 'EWALLET' };

    if (!plate) {
      return res.status(400).json({ success: false, message: 'plate là bắt buộc.' });
    }

    const result = await checkoutService.submit({ plate, method });
    return res.status(200).json({ success: true, data: result });
  }),
};




