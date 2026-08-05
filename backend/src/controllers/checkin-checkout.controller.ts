import { Response } from 'express';
import { checkInService } from '../services/checkin-checkout.service';
import { checkoutService } from '../services/checkout.service';
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

  getHistory: asyncHandler(async (req: AuthRequest, res: Response) => {
    const plate = req.query.plate as string | undefined;
    const records = await checkInService.getHistoryRecords(plate);
    return res.status(200).json({ success: true, data: records });
  }),
};

export const checkOutController = {
  preview: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { recordId } = req.params;
    const result = await checkoutService.previewFee(recordId);
    return res.status(200).json({ success: true, data: result });
  }),

  checkOut: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await checkoutService.submit({
      checkInRecordId: req.body.checkInRecordId,
      method: req.body.paymentMethod ?? 'CASH',
      staffId: req.user!.id,
      pin: req.body.pin || req.body.monthlyAccessPin,
    });
    return res.status(200).json({ success: true, data: result });
  }),
};   
