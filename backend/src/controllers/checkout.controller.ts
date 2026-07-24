import { Response } from 'express';
import { checkoutService } from '../services/checkout.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const checkoutController = {
  // GET /api/checkout/lookup?plate=51A-222.22
  lookup: asyncHandler(async (req: AuthRequest, res: Response) => {
    const plate = (req.query.plate as string) || (req.params.plate as string);
    if (!plate) {
      return res.status(400).json({ success: false, message: 'plate là bắt buộc.' });
    }
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
    const {
      plate,
      method,
    } = req.body as {
      plate?: string;
      method?: 'CASH' | 'CARD' | 'EWALLET';
    };

    if (!plate) {
      return res.status(400).json({
        success: false,
        message: 'plate là bắt buộc.',
      });
    }

    const result = await checkoutService.submit({ plate, method, staffId: req.user!.id });

    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  createStripeSession: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { checkInRecordId } = req.params;
    if (!checkInRecordId) {
      return res.status(400).json({ success: false, message: 'checkInRecordId là bắt buộc.' });
    }
    const result = await checkoutService.createStripeSession(checkInRecordId, req.user!.id);
    return res.status(200).json({ success: true, data: result });
  }),

  getStripeStatus: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { checkInRecordId } = req.params;
    if (!checkInRecordId) {
      return res.status(400).json({ success: false, message: 'checkInRecordId là bắt buộc.' });
    }
    const result = await checkoutService.getStripeStatus(checkInRecordId);
    return res.status(200).json({ success: true, data: result });
  }),

  getStripeStatusBySession: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ success: false, message: 'session_id là bắt buộc.' });
    }
    const result = await checkoutService.getStripeStatusBySession(session_id as string);
    return res.status(200).json({ success: true, data: result });
  }),
};
