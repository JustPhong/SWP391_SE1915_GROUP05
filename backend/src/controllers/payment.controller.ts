import { Response } from 'express';
import { paymentService } from '../services/payment.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const paymentController = {
  recordPayment: asyncHandler(async (req: AuthRequest, res: Response) => {
    const payment = await paymentService.recordPayment(req.body);
    return res.status(201).json({ success: true, data: payment });
  }),

  getPayments: asyncHandler(async (req: AuthRequest, res: Response) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;   
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const payments = await paymentService.getAllPayments(startDate, endDate);
    return res.status(200).json({ success: true, data: payments });
  },
  ),
};
