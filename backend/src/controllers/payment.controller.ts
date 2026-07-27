import { Response } from 'express';
import { paymentService } from '../services/payment.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';
import { config } from '../config';
import { stripe } from '../config/stripe';
import { bookingService } from '../services/booking.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import { checkoutService } from '../services/checkout.service';

export const paymentController = {
  getVietQRConfig: asyncHandler(async (req: AuthRequest, res: Response) => {
    return res.status(200).json({ success: true, data: config.vietqr });
  }),

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
  }),

  handleStripeWebhook: asyncHandler(async (req: any, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      throw new AppError(400, `Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      if (!session) throw new AppError(400, 'Invalid Stripe webhook object format.');

      const metadata = session.metadata;
      const paymentType = metadata?.paymentType;
      const paymentPurpose = metadata?.paymentPurpose;

      if (paymentType === 'BOOKING_FEE') {
        const result = await bookingService.handleStripeWebhook(event);
        return res.status(200).json({ success: true, data: result });
      } else if (paymentPurpose === 'PARKING_FEE' || paymentType === 'PARKING_FEE') {
        const result = await checkoutService.handleStripeWebhook(event);
        return res.status(200).json({ success: true, data: result });
      } else {
        const result = await monthlyPackageService.handleStripeWebhook(event);
        return res.status(200).json({ success: true, data: result });
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data?.object;
      const metadata = session?.metadata;
      const paymentType = metadata?.paymentType;

      if (paymentType === 'BOOKING_FEE') {
        const result = await bookingService.handleStripeExpired(event);
        return res.status(200).json({ success: true, data: result });
      }
      return res.status(200).json({ success: true, message: 'Session expired, no action needed' });
    }

    return res.status(200).json({ success: true, message: 'Unhandled event type' });
  }),
};

