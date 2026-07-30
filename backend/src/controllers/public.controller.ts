import { Response } from 'express';
import prisma from '../config/db';
import { asyncHandler } from '../utils/helpers';
import { calcFee } from '../utils/fee';
import { feeRuleService } from '../services/feeRule.service';
import { stripe } from '../config/stripe';
import { AppError } from '../utils/helpers';

interface RateLimitBucket {
  attempts: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

function checkRateLimit(ip: string, limit = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const bucket = rateLimitStore.get(ip);
  if (!bucket) {
    rateLimitStore.set(ip, { attempts: 1, resetTime: now + windowMs });
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

type VehicleBucket = { available: number; total: number };
type ZoneBucket = { car: VehicleBucket; motorbike: VehicleBucket };
type AvailabilityData = {
  casual: ZoneBucket;
  monthly: ZoneBucket;
  total: { available: number; capacity: number };
};

/**
 * GET /api/public/availability
 * No auth required — used by the landing-page StatusStrip.
 *
 * Counts AVAILABLE slots grouped by (floor.customerType, floor.vehicleType).
 * Each zone/vehicle bucket reports both:
 *   - available: slots whose status === 'AVAILABLE'
 *   - total:     ALL slots regardless of status (slot count, not Floor.capacity,
 *                so it reflects the real rows currently in the DB).
 * Grand totals are kept as before (available across all zones, capacity across
 * all slots).
 */
export const publicController = {
  getAvailability: asyncHandler(async (_req, res: Response) => {
    const allRows = await prisma.parkingSlot.findMany({
      select: {
        status: true,
        floorId: true,
        floor: {
          select: {
            id: true,
            vehicleType: true,
            customerType: true,
          },
        },
      },
    });

    const now = new Date();
    const activeBookings = await prisma.booking.findMany({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        expiresAt: { gt: now },
        checkInRecords: { none: {} },
      },
      select: {
        floorId: true,
      },
    });

    const activeBookingsPerFloor: Record<number, number> = {};
    for (const b of activeBookings) {
      activeBookingsPerFloor[b.floorId] = (activeBookingsPerFloor[b.floorId] || 0) + 1;
    }

    const data: AvailabilityData = {
      casual: {
        car: { available: 0, total: 0 },
        motorbike: { available: 0, total: 0 },
      },
      monthly: {
        car: { available: 0, total: 0 },
        motorbike: { available: 0, total: 0 },
      },
      total: { available: 0, capacity: 0 },
    };

    const floorsMap: Record<number, { customerType: string; vehicleType: string; slots: { status: string }[] }> = {};
    for (const row of allRows) {
      if (!floorsMap[row.floorId]) {
        floorsMap[row.floorId] = {
          customerType: row.floor.customerType,
          vehicleType: row.floor.vehicleType,
          slots: [],
        };
      }
      floorsMap[row.floorId].slots.push(row);
    }

    for (const [floorIdStr, floorInfo] of Object.entries(floorsMap)) {
      const floorId = Number(floorIdStr);
      const ct = floorInfo.customerType;
      const vt = floorInfo.vehicleType;
      if (ct !== 'CASUAL' && ct !== 'MONTHLY') continue;
      if (vt !== 'CAR' && vt !== 'MOTORBIKE') continue;

      const physicalAvailable = floorInfo.slots.filter(s => s.status === 'AVAILABLE').length;
      const total = floorInfo.slots.length;
      const activeBookingsCount = activeBookingsPerFloor[floorId] || 0;
      const receivable = Math.max(0, physicalAvailable - activeBookingsCount);

      const zone = data[ct === 'CASUAL' ? 'casual' : 'monthly'];
      const bucket = zone[vt === 'CAR' ? 'car' : 'motorbike'];

      bucket.total += total;
      data.total.capacity += total;

      bucket.available += receivable;
      data.total.available += receivable;
    }

    return res.status(200).json({
      success: true,
      data,
    });
  }),

  // POST /api/public/guest/lookup
  lookupGuestVehicle: asyncHandler(async (req, res: Response) => {
    const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    const pin = req.body.pin as string | undefined;
    const qrToken = req.body.qrToken as string | undefined;

    if (!pin && !qrToken) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã PIN hoặc mã QR.' });
    }

    // Rate limiting: 5 attempts/min for PIN lookups, 20/min for QR lookups
    const limit = pin ? 5 : 20;
    if (!checkRateLimit(clientIp, limit, 60000)) {
      return res.status(429).json({ success: false, message: 'Bạn đã thử quá nhiều lần. Vui lòng đợi 1 phút.' });
    }

    let record = null;
    if (qrToken) {
      record = await prisma.checkInRecord.findFirst({
        where: {
          guestCredential: {
            qrToken: qrToken,
            active: true
          },
          checkOutTime: null
        },
        include: { vehicle: true, floor: true, payments: true, guestCredential: true },
      });
    } else if (pin) {
      const cleanPin = pin.trim();
      record = await prisma.checkInRecord.findFirst({
        where: {
          guestCredential: {
            pin: cleanPin,
            active: true
          },
          checkOutTime: null
        },
        include: { vehicle: true, floor: true, payments: true, guestCredential: true },
      });
    }

    if (!record) {
      // Generic non-enumerating error to prevent scanning
      return res.status(404).json({ success: false, message: 'Thông tin tìm kiếm không tồn tại hoặc đã hết hạn.' });
    }

    const now = new Date();
    const checkIn = new Date(record.checkInTime);
    const durationMinutes = Math.round((now.getTime() - checkIn.getTime()) / 60_000);
    const config = await feeRuleService.getFeeConfig();
    const { total: totalFee, breakdown } = calcFee(checkIn, now, record.vehicle.type as 'CAR' | 'MOTORBIKE', config);

    // Sum successful PARKING_FEE payments for this record
    const totalSuccessfullyPaid = record.payments?.reduce((sum, p) => sum + (p.status === 'SUCCESS' && p.type === 'PARKING_FEE' ? parseFloat(String(p.amount)) : 0), 0) ?? 0;

    let additionalAmountDue = Math.max(0, totalFee - totalSuccessfullyPaid);
    let isGraceActive = false;
    let graceExpiresAt = null;

    if (record.prepaidAt) {
      graceExpiresAt = new Date(record.prepaidAt.getTime() + 300 * 1000);
      if (now <= graceExpiresAt) {
        additionalAmountDue = 0;
        isGraceActive = true;
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      data: {
        recordId: record.id,
        plate: record.vehicle.plateNumber,
        vehicleType: record.vehicle.type,
        checkInTime: record.checkInTime.toISOString(),
        durationMinutes,
        floorName: record.floor?.name ?? 'Không xác định',
        floorCode: record.floor?.floorCode ?? '',
        totalFee,
        totalSuccessfullyPaid,
        additionalAmountDue,
        prepaidAt: record.prepaidAt ? record.prepaidAt.toISOString() : null,
        graceExpiresAt: graceExpiresAt ? graceExpiresAt.toISOString() : null,
        isGraceActive,
        breakdown,
      },
    });
  }),

  // POST /api/public/guest/stripe-session
  createGuestStripeSession: asyncHandler(async (req, res: Response) => {
    const { recordId, pin, qrToken } = req.body;
    const GENERIC_ERROR = { success: false, message: 'Thông tin tìm kiếm không tồn tại hoặc đã hết hạn.' };

    if (!recordId) {
      return res.status(400).json({ success: false, message: 'recordId là bắt buộc.' });
    }

    // Require exactly one credential — not both, not neither
    if ((!pin && !qrToken) || (pin && qrToken)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đúng một trong hai: mã PIN hoặc mã QR.' });
    }

    // Format validation — PIN must be exactly 6 numeric characters
    if (pin !== undefined && !/^\d{6}$/.test(pin)) {
      return res.status(404).json(GENERIC_ERROR);
    }

    // Format validation — QR token must be a 64-char lowercase hex string (32 bytes from crypto.randomBytes(32).toString('hex'))
    if (qrToken !== undefined && !/^[0-9a-f]{64}$/.test(qrToken)) {
      return res.status(404).json(GENERIC_ERROR);
    }

    // Verify the caller possesses the active credential for this exact visit
    let credential = null;
    if (qrToken) {
      credential = await prisma.guestAccessCredential.findFirst({
        where: { checkInRecordId: recordId, qrToken, active: true },
      });
    } else if (pin) {
      credential = await prisma.guestAccessCredential.findFirst({
        where: { checkInRecordId: recordId, pin, active: true },
      });
    }

    if (!credential) {
      return res.status(404).json(GENERIC_ERROR);
    }

    const record = await prisma.checkInRecord.findUnique({
      where: { id: recordId },
      include: { vehicle: true, floor: true, payments: true, guestCredential: true },
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Thông tin tìm kiếm không tồn tại hoặc đã hết hạn.' });
    }

    if (record.checkOutTime !== null || !record.guestCredential?.active) {
      return res.status(404).json({ success: false, message: 'Thông tin tìm kiếm không tồn tại hoặc đã hết hạn.' });
    }

    const now = new Date();
    const config = await feeRuleService.getFeeConfig();
    const { total: totalFee } = calcFee(new Date(record.checkInTime), now, record.vehicle.type as 'CAR' | 'MOTORBIKE', config);

    const totalSuccessfullyPaid = record.payments?.reduce((sum, p) => sum + (p.status === 'SUCCESS' && p.type === 'PARKING_FEE' ? parseFloat(String(p.amount)) : 0), 0) ?? 0;

    let additionalAmountDue = Math.max(0, totalFee - totalSuccessfullyPaid);

    if (record.prepaidAt) {
      const graceExpiresAt = new Date(record.prepaidAt.getTime() + 300 * 1000);
      if (now <= graceExpiresAt) {
        additionalAmountDue = 0;
      }
    }

    if (additionalAmountDue <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền cần thanh toán phải lớn hơn 0.' });
    }

    // Check for existing pending CARD prepayment payment record
    let payment = await prisma.payment.findFirst({
      where: {
        checkInRecordId: record.id,
        type: 'PARKING_FEE',
        method: 'CARD',
        status: 'PENDING',
      },
    });

    if (payment) {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          amount: additionalAmountDue,
        },
      });
    } else {
      payment = await prisma.payment.create({
        data: {
          checkInRecordId: record.id,
          bookingId: null,
          monthlyPackageId: null,
          amount: additionalAmountDue,
          method: 'CARD',
          type: 'PARKING_FEE',
          status: 'PENDING',
        },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      success_url: `${frontendUrl}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/?stripe=cancelled`,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name: `Thanh toán trước phí gửi xe ParkSmart - ${record.vehicle.plateNumber}`,
              description: `Phí thanh toán trước cho xe tại tầng ${record.floor?.name ?? 'Không xác định'}`,
            },
            unit_amount: additionalAmountDue,
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentPurpose: 'PARKING_FEE',
        paymentType: 'PARKING_FEE',
        paymentId: payment.id,
        checkInRecordId: record.id,
        isPrepayment: 'true',
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { transactionCode: session.id },
    });

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl: session.url ?? '',
      },
    });
  }),

  // GET /api/public/guest/stripe-status
  getGuestStripeStatus: asyncHandler(async (req, res: Response) => {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ success: false, message: 'session_id là bắt buộc.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { transactionCode: session_id as string },
      include: { checkInRecord: { include: { vehicle: true, floor: true } } },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        checkInRecordStatus: payment.checkInRecord?.status ?? 'UNKNOWN',
      },
    });
  }),
};
