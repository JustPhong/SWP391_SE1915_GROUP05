import { Response } from 'express';
import { checkoutService } from '../services/checkout.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';
import { monthlyPackageService } from '../services/monthlyPackage.service';

interface RateLimitBucket {
  attempts: number;
  resetTime: number;
}
const pinRateLimitStore = new Map<string, RateLimitBucket>();

function checkPinRateLimit(ip: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const bucket = pinRateLimitStore.get(ip);
  if (!bucket) {
    pinRateLimitStore.set(ip, { attempts: 1, resetTime: now + windowMs });
    return true;
  }
  if (now > bucket.resetTime) {
    bucket.attempts = 1;
    bucket.resetTime = now + windowMs;
    return true;
  }
  bucket.attempts += 1;
  return bucket.attempts <= limit;
}

export const checkoutController = {
  // GET /api/checkout/lookup?plate=51A-222.22
  lookup: asyncHandler(async (req: AuthRequest, res: Response) => {
    const plate = (req.query.plate as string) || (req.params.plate as string);
    if (!plate) {
      return res.status(400).json({ success: false, message: 'plate là bắt buộc.' });
    }
    const pin = (req.query.pin as string) || (req.query.monthlyAccessPin as string);
    if (pin) {
      if (!/^\d{6}$/.test(pin)) {
        return res.status(400).json({ success: false, message: 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
      try {
        await monthlyPackageService.verifyMonthlyPackageAccessByPin(plate, pin);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
    }
    const result = await checkoutService.lookupPlate(plate);
    if (pin && result.found) {
      result.isMonthly = true;
      result.fee = 0;
      result.amountDue = 0;
    }
    return res.status(200).json({ success: true, data: result });
  }),

  // POST /api/checkout/lookup-by-pin
  lookupByPin: asyncHandler(async (req: AuthRequest, res: Response) => {
    const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    if (!checkPinRateLimit(clientIp)) {
      return res.status(429).json({ success: false, message: 'Bạn đã thực hiện quá nhiều yêu cầu tra cứu PIN. Vui lòng đợi 1 phút.' });
    }
    const { pin } = req.body as { pin?: string };
    if (!pin) {
      return res.status(400).json({ success: false, message: 'pin là bắt buộc.' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'Mã PIN không hợp lệ. Phải gồm đúng 6 chữ số.' });
    }
    const result = await checkoutService.lookupByPin(pin);
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

    const pin = (req.body.pin as string) || (req.body.monthlyAccessPin as string);
    if (pin) {
      if (!/^\d{6}$/.test(pin)) {
        return res.status(400).json({ success: false, message: 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
      try {
        await monthlyPackageService.verifyMonthlyPackageAccessByPin(plate, pin);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || 'Mã PIN hoặc thông tin vé tháng không hợp lệ.' });
      }
    }

    const result = await checkoutService.submit({ plate, method, staffId: req.user!.id, pin });

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

  lookupMonthlyQr: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { qrToken } = req.body as { qrToken?: string };
    if (!qrToken) {
      return res.status(400).json({ success: false, message: 'qrToken là bắt buộc.' });
    }
    const result = await checkoutService.lookupMonthlyQr(qrToken);
    return res.status(200).json({ success: true, data: result });
  }),
};
