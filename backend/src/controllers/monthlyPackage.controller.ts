import { Response } from 'express';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';
import { stripe } from '../config/stripe';

export const monthlyPackageController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.create({
      ...req.body,
      userId: req.user!.id,
      startDate: new Date(req.body.startDate),
      expiryDate: new Date(req.body.expiryDate),
    });
    return res.status(201).json({ success: true, data: pkg });
  }),

  createCheckoutSession: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { vehicleId, planId } = req.body;
    const result = await monthlyPackageService.createCheckoutSession({
      userId: req.user!.id,
      vehicleId,
      planId,
    });
    return res.status(200).json({ success: true, data: result });
  }),

  handleWebhook: asyncHandler(async (req: any, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!stripe) {
      throw new AppError(400, 'Chức năng thanh toán Stripe chưa được cấu hình trên server.');
    }

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

    const result = await monthlyPackageService.handleStripeWebhook(event);
    return res.status(200).json({ success: true, data: result });
  }),

  getActivePackages: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const packages = await monthlyPackageService.getActivePackages();
    return res.status(200).json({ success: true, data: packages });
  }),

  getMyPackages: asyncHandler(async (req: AuthRequest, res: Response) => {
    const packages = await monthlyPackageService.getByUser(req.user!.id);
    return res.status(200).json({ success: true, data: packages });
  }),

  getByVehicle: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.getByVehicle(req.params.vehicleId);
    return res.status(200).json({ success: true, data: pkg });
  }),

  renewPackage: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.renewPackage(req.params.packageId, req.user!.id);
    return res.status(200).json({ success: true, data: pkg });
  }),

  setAutoRenew: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.setAutoRenew(req.params.packageId, req.user!.id, req.body.enabled);
    return res.status(200).json({ success: true, data: pkg });
  }),

  cancelPackage: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.cancelPackage(req.params.packageId, req.user!.id);
    return res.status(200).json({ success: true, data: pkg });
  }),

  getQuotas: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const quotas = await monthlyPackageService.getZoneQuotas();
    return res.status(200).json({ success: true, data: quotas });
  }),
};
