import { Response } from 'express';
import { checkInService, checkOutService } from '../services/checkin-checkout.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const checkInController = {
  checkIn: asyncHandler(async (req: AuthRequest, res: Response) => {
    const record = await checkInService.checkIn({
      plateNumber: req.body.plateNumber,
      vehicleType: req.body.vehicleType,
      slotId: req.body.slotId,
      staffId: req.user!.id,
    });
    return res.status(201).json({ success: true, data: record });
  }),

  getActiveRecords: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const records = await checkInService.getActiveRecords();
    return res.status(200).json({ success: true, data: records });
  }),
};

export const checkOutController = {
  preview: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { recordId } = req.params;
    const result = await checkOutService.previewFee(recordId);
    return res.status(200).json({ success: true, data: result });
  }),

  checkOut: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await checkOutService.checkOut({
      checkInRecordId: req.body.checkInRecordId,
      paymentMethod: req.body.paymentMethod ?? 'CASH',
    });
    return res.status(200).json({ success: true, data: result });
  }),
};   
