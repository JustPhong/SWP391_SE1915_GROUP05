import { Response } from 'express';
import { checkinService } from '../services/checkin.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { slotSuggestionService } from '../services/slotSuggestion.service';


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
    const { plate, vehicleType, customerType, slotCode, isMonthly, frontImageUrl, rearImageUrl } = req.body;
    const result = await checkinService.submit({
      plate,
      vehicleType,
      customerType,
      slotCode,
      isMonthly,
      frontImageUrl,
      rearImageUrl,
    });
    return res.status(201).json({ success: true, data: result });
  }),
  // GET /api/checkin/suggest?vehicleType=CAR&zone=CASUAL&top=3
suggest: asyncHandler(async (req: AuthRequest, res: Response) => {
  const vehicleType = (req.query.vehicleType as string) || 'CAR';
  const zone = (req.query.zone as 'MONTHLY' | 'CASUAL') || 'CASUAL';
  const top = parseInt(req.query.top as string) || 1;

  if (top > 1) {
    const slots = await slotSuggestionService.suggestTopSlots(vehicleType, zone, top);
    return res.status(200).json({ success: true, data: slots });
  }

  const slot = await slotSuggestionService.suggestSlot(vehicleType, zone);
  if (!slot) {
    return res.status(404).json({ success: false, message: 'Không còn slot trống phù hợp' });
  }
  return res.status(200).json({ success: true, data: slot });
}),
};
     