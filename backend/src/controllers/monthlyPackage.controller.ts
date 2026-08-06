import { Response } from 'express';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';
import { stripe } from '../config/stripe';

export const monthlyPackageController = {
  reconcileSession: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      throw new AppError(400, 'sessionId không hợp lệ.');
    }
    const result = await monthlyPackageService.reconcileStripeSession(sessionId, req.user!.id);
    return res.status(200).json({ success: true, data: result });
  }),

  createCheckoutSession: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { vehicleId, planId, sessionId } = req.body;
    const result = await monthlyPackageService.createCheckoutSession({
      userId: req.user!.id,
      vehicleId,
      planId,
      sessionId,
    });
    if (result.status === 'ALREADY_PROCESSED') {
      return res.status(409).json({
        success: true,
        alreadyProcessed: true,
        message: 'Giao dịch đã được thanh toán thành công.',
        data: {
          packageId: result.packageId,
          paymentId: result.paymentId,
        },
      });
    }
    return res.status(200).json({ success: true, data: result });
  }),

  handleWebhook: asyncHandler(async (req: any, res: Response) => {
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

    const result = await monthlyPackageService.handleStripeWebhook(event);
    return res.status(200).json({ success: true, data: result });
  }),

  getActivePackages: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const packages = await monthlyPackageService.getActivePackages();
    const sanitized = packages.map((pkg: any) => {
      const { monthlyAccessPin, ...rest } = pkg;
      return rest;
    });
    return res.status(200).json({ success: true, data: sanitized });
  }),

  getMyPackages: asyncHandler(async (req: AuthRequest, res: Response) => {
    const packages = await monthlyPackageService.getByUser(req.user!.id);
    return res.status(200).json({ success: true, data: packages });
  }),

  getByVehicle: asyncHandler(async (req: AuthRequest, res: Response) => {
    const pkg = await monthlyPackageService.getByVehicle(req.params.vehicleId);
    if (!pkg) {
      return res.status(200).json({ success: true, data: null });
    }
    const isOwner = pkg.userId === req.user!.id;
    if (!isOwner) {
      (pkg as any).monthlyAccessPin = undefined;
    }
    return res.status(200).json({ success: true, data: pkg });
  }),

  renewPackage: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { selectedPlanId, sessionId } = req.body;
    const result = await monthlyPackageService.renewPackage(req.params.packageId, req.user!.id, selectedPlanId, sessionId);
    if (result.status === 'ALREADY_PROCESSED') {
      return res.status(409).json({
        success: true,
        alreadyProcessed: true,
        message: 'Giao dịch đã được thanh toán thành công.',
        data: {
          packageId: result.packageId,
          paymentId: result.paymentId,
        },
      });
    }
    return res.status(200).json({ success: true, data: result });
  }),

  abandonPayment: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { paymentId, sessionId } = req.body;
    if (!paymentId || !sessionId) {
      throw new AppError(400, 'Missing paymentId or sessionId in request body.');
    }
    const result = await monthlyPackageService.abandonPayment({
      packageId: req.params.packageId,
      userId: req.user!.id,
      paymentId,
      sessionId,
    });
    return res.status(200).json({ success: true, data: result });
  }),

  getPlans: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const plans = monthlyPackageService.getPlans();
    return res.status(200).json({ success: true, data: plans });
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

  getFloorQuotas: asyncHandler(async (req: AuthRequest, res: Response) => {
    const floorId = parseInt(req.params.floorId, 10);
    if (isNaN(floorId)) {
      throw new AppError(400, 'floorId phải là số nguyên hợp lệ');
    }
    const quotas = await monthlyPackageService.getFloorQuotas(floorId);
    return res.status(200).json({ success: true, data: quotas });
  }),

  ensureAccessPin: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { packageId } = req.params;
    const result = await monthlyPackageService.ensureAccessPin(packageId, req.user!.id);
    return res.status(200).json({ success: true, data: result });
  }),
};
