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

    const result = await checkoutService.submit({ plate, method });

    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  // POST /api/checkout/lost-ticket
  lostTicket: asyncHandler(async (req: AuthRequest, res: Response) => {
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

    const result = await checkoutService.submitLostTicket({
      plate,
      method,
      staffId: req.user!.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  }),

  // POST /api/checkout/:ticketId/photos
  uploadPhotos: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ticketId } = req.params as { ticketId: string };
    const { front, back } = req.body as { front?: string; back?: string };
    if (!front || !back) {
      return res.status(400).json({ success: false, message: 'Ảnh đầu xe và đuôi xe là bắt buộc.' });
    }
    const record = await checkoutService.uploadPhotos(ticketId, { front, back });
    return res.status(200).json({ success: true, data: record });
  }),

  // POST /api/checkout/calculate-fee/:ticketId
  calculateFee: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ticketId } = req.params as { ticketId: string };
    const { checkOutTime } = req.body as { checkOutTime?: string };
    const result = await checkoutService.calculateFee(ticketId, checkOutTime);
    return res.status(200).json({ success: true, data: result });
  }),

  // POST /api/checkout/complete/:ticketId
  complete: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ticketId } = req.params as { ticketId: string };
    const { method, photos } = req.body as { method?: 'CASH' | 'CARD' | 'EWALLET'; photos?: { front: string; back: string } };
    const result = await checkoutService.complete(ticketId, { method, photos, staffId: req.user!.id });
    return res.status(200).json({ success: true, data: result });
  }),
};
