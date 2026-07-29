import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { calcFee } from '../utils/fee';
import { feeRuleService } from './feeRule.service';
import { Prisma } from '@prisma/client';
import { stripe } from '../config/stripe';
import Stripe from 'stripe';
import { acquireVehicleOrPlateLock, getVehicleOperationalState } from '../utils/vehicleState';
import fs from 'fs';
import path from 'path';

function resolveCheckInImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    const localPath = path.join(__dirname, '../..', url);
    if (fs.existsSync(localPath)) {
      return url;
    }
  }
  return null;
}

// ── Lookup result shapes ──────────────────────────────────
export interface CheckoutLookupResult {
  found: boolean;
  // ── only when found === true ──
  recordId?: string;
  vehicleId?: string;
  plate?: string;
  vehicleType?: 'CAR' | 'MOTORBIKE';
  slotCode?: string | null;
  isMonthly?: boolean;
  checkInTime?: string;
  now?: string;
  durationMinutes?: number;
  fee?: number;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  packageExpiry?: string;
  grossParkingFee?: number;
  bookingDepositPaid?: number;
  amountDue?: number;
  frontImageUrl?: string | null;
  rearImageUrl?: string | null;
  isLegacy?: boolean;
}

export interface ParkedVehicle {
  checkInRecordId: string;
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  customerType: 'booking' | 'monthly' | 'casual';
  checkInTime: string;
  floorId: number;
  floorName: string;
  floorCode: string;
  areaLabel: string;
  durationMinutes: number;
}

export interface CheckoutSubmitResult {
  ok: boolean;
  plate: string;
  slotCode: string | null;
  fee: number;
  isMonthly: boolean;
  checkOutTime: string;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
  grossParkingFee: number;
  bookingDepositPaid: number;
  amountDue: number;
  checkInTime: string;
  durationMinutes: number;
  floorName: string;
  floorCode: string;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
}

// ── Service ──────────────────────────────────────────────
export const checkoutService = {
  // ── GET /api/checkout/lookup/:plate ───────────────────────
  async lookupPlate(plate: string): Promise<CheckoutLookupResult> {
    const cleaned = plate.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');

    const records = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        status: 'PARKING',
        vehicle: {
          OR: [
            { plateNumber: cleaned },
            { plateNumber: stripped },
          ],
        },
      },
      include: {
        vehicle: {
          include: {
            owner: {
              select: {
                fullName: true,
                phoneNumber: true,
                email: true,
              },
            },
          },
        },
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
      },
    });

    if (records.length === 0) {
      return { found: false };
    }
    if (records.length > 1) {
      const sessionIds = records.map(r => r.id).join(', ');
      throw new AppError(
        409,
        `Phát hiện nhiều lượt gửi xe đang hoạt động trùng lặp (IDs: ${sessionIds}). Yêu cầu kiểm tra và xử lý dữ liệu hành chính.`
      );
    }
    const record = records[0];

    const vehicle = record.vehicle;
    const now = new Date();
    const checkIn = new Date(record.checkInTime);
    const durationMinutes = Math.round((now.getTime() - checkIn.getTime()) / 60_000);
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = calcFee(
      checkIn,
      now,
      vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );

    let depositCredit = 0;
    let bookingToUse = null;
    if (!record.isMonthly) {
      if (record.bookingId) {
        bookingToUse = await prisma.booking.findUnique({
          where: { id: record.bookingId },
        });
        if (bookingToUse && bookingToUse.status === 'FULFILLED' && bookingToUse.depositStatus === 'PAID' && bookingToUse.bookingDepositAppliedAt === null) {
          const paidPayment = await prisma.payment.findFirst({
            where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
          });
          if (paidPayment) {
            depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
          }
        }
      } else {
        bookingToUse = await prisma.booking.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: 'FULFILLED',
            depositStatus: 'PAID',
            bookingDepositAppliedAt: null,
          },
          orderBy: { bookingTime: 'desc' },
        });
        if (bookingToUse) {
          const paidPayment = await prisma.payment.findFirst({
            where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
          });
          if (paidPayment) {
            depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
          }
        }
      }
    }
    const amountDue = Math.max(0, total - depositCredit);

    let packageExpiry: string | undefined;
    if (record.isMonthly) {
      const pkg = await prisma.monthlyPackage.findFirst({
        where: {
          vehicleId: vehicle.id,
          status: 'ACTIVE',
        },
        select: {
          expiryDate: true,
        },
      });
      if (pkg) {
        packageExpiry = pkg.expiryDate.toISOString();
      }
    }

    const isLegacy = !((record.frontImageUrl && record.frontImageUrl.startsWith('https://res.cloudinary.com')) ||
                       (record.rearImageUrl && record.rearImageUrl.startsWith('https://res.cloudinary.com')));

    return {
      found: true,
      recordId: record.id,
      vehicleId: vehicle.id,
      plate: vehicle.plateNumber,
      vehicleType: vehicle.type as 'CAR' | 'MOTORBIKE',
      slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      isMonthly: record.isMonthly,
      checkInTime: record.checkInTime.toISOString(),
      now: now.toISOString(),
      durationMinutes,
      fee: record.isMonthly ? 0 : amountDue,
      breakdown,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      year: vehicle.year,
      seats: vehicle.seats,
      ownerName: vehicle.owner?.fullName ?? null,
      ownerPhone: vehicle.owner?.phoneNumber ?? null,
      ownerEmail: vehicle.owner?.email ?? null,
      packageExpiry,
      grossParkingFee: record.isMonthly ? 0 : total,
      bookingDepositPaid: record.isMonthly ? 0 : depositCredit,
      amountDue: record.isMonthly ? 0 : amountDue,
      frontImageUrl: resolveCheckInImageUrl(record.frontImageUrl),
      rearImageUrl: resolveCheckInImageUrl(record.rearImageUrl),
      isLegacy,
    };
  },

  // ── GET /api/checkout/parked ─────────────────────────────
  async getParkedVehicles(): Promise<ParkedVehicle[]> {
    const records = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        status: 'PARKING',
      },
      include: {
        vehicle: true,
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
      },
      orderBy: { checkInTime: 'desc' },
    });

    const now = new Date();

    return records.map((r) => {
      const floor = r.floor ?? r.slot?.floor ?? null;
      const durationMinutes = Math.round((now.getTime() - new Date(r.checkInTime).getTime()) / 60_000);

      let customerType: 'booking' | 'monthly' | 'casual' = 'casual';
      if (r.isMonthly) {
        customerType = 'monthly';
      } else if (r.bookingId) {
        customerType = 'booking';
      }

      return {
        checkInRecordId: r.id,
        plate: r.vehicle.plateNumber,
        vehicleType: r.vehicle.type as 'CAR' | 'MOTORBIKE',
        customerType,
        checkInTime: r.checkInTime.toISOString(),
        floorId: floor?.id ?? 0,
        floorName: floor?.name ?? 'Không xác định',
        floorCode: floor?.floorCode ?? '',
        areaLabel: r.allowedTier ? (r.allowedTier === 'VIP' ? 'VIP' : r.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản') : 'Tự do',
        durationMinutes,
      };
    });
  },

  // ── GET /api/checkout/preview/:recordId ───────────────────
  async previewFee(recordId: string): Promise<{
    fee: number;
    breakdown: any[];
    depositCredit: number;
    amountDue: number;
    grossParkingFee: number;
    bookingDepositPaid: number;
    checkInTime: string;
    calculatedAt: string;
    durationMinutes: number;
    baseParkingFee: number;
    bookingDepositApplied: number;
    discountAmount: number;
  }> {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: recordId },
      include: {
        vehicle: true,
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
      },
    });

    if (!record) {
      throw new AppError(404, 'Không tìm thấy thông tin lượt gửi xe');
    }

    const now = new Date();
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = calcFee(
      new Date(record.checkInTime),
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config
    );

    let depositCredit = 0;
    let bookingToUse = null;
    if (!record.isMonthly) {
      if (record.bookingId) {
        bookingToUse = await prisma.booking.findUnique({
          where: { id: record.bookingId },
        });
        if (bookingToUse && bookingToUse.status === 'FULFILLED' && bookingToUse.depositStatus === 'PAID' && bookingToUse.bookingDepositAppliedAt === null) {
          const paidPayment = await prisma.payment.findFirst({
            where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
          });
          if (paidPayment) {
            depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
          }
        }
      } else {
        bookingToUse = await prisma.booking.findFirst({
          where: {
            vehicleId: record.vehicleId,
            status: 'FULFILLED',
            depositStatus: 'PAID',
            bookingDepositAppliedAt: null,
          },
          orderBy: { bookingTime: 'desc' },
        });
        if (bookingToUse) {
          const paidPayment = await prisma.payment.findFirst({
            where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
          });
          if (paidPayment) {
            depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
          }
        }
      }
    }

    const amountDue = Math.max(0, total - depositCredit);
    const durationMinutes = Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60_000);

    return {
      fee: record.isMonthly ? 0 : amountDue,
      breakdown: record.isMonthly ? [] : breakdown,
      depositCredit: record.isMonthly ? 0 : depositCredit,
      amountDue: record.isMonthly ? 0 : amountDue,
      grossParkingFee: record.isMonthly ? 0 : total,
      bookingDepositPaid: record.isMonthly ? 0 : depositCredit,
      checkInTime: record.checkInTime.toISOString(),
      calculatedAt: now.toISOString(),
      durationMinutes,
      baseParkingFee: record.isMonthly ? 0 : total,
      bookingDepositApplied: record.isMonthly ? 0 : depositCredit,
      discountAmount: 0,
    };
  },

  // ── POST /api/checkout ───────────────────────────────────
  async submit(params: {
    checkInRecordId?: string;
    plate?: string;
    method?: 'CASH' | 'CARD' | 'EWALLET';
    staffId: string;
  }): Promise<CheckoutSubmitResult> {
    const { checkInRecordId, plate, method = 'CASH', staffId } = params;

    if (!['CASH', 'CARD', 'EWALLET'].includes(method)) {
      throw new AppError(400, 'Phương thức thanh toán không hợp lệ.');
    }

    let record: any = null;

    if (checkInRecordId) {
      record = await prisma.checkInRecord.findUnique({
        where: { id: checkInRecordId },
        include: {
          vehicle: true,
          slot: {
            include: {
              floor: true,
            },
          },
          floor: true,
        },
      });
    } else if (plate) {
      const cleaned = plate.trim().toUpperCase();
      const stripped = cleaned.replace(/[-.\s]/g, '');
      const activeRecords = await prisma.checkInRecord.findMany({
        where: {
          checkOutTime: null,
          status: 'PARKING',
          vehicle: {
            OR: [
              { plateNumber: cleaned },
              { plateNumber: stripped },
            ],
          },
        },
        include: {
          vehicle: true,
          slot: {
            include: {
              floor: true,
            },
          },
          floor: true,
        },
      });

      if (activeRecords.length === 0) {
        throw new AppError(404, 'Không tìm thấy lượt đỗ xe đang hoạt động.');
      }
      if (activeRecords.length > 1) {
        const sessionIds = activeRecords.map(r => r.id).join(', ');
        throw new AppError(
          409,
          `Phát hiện nhiều lượt gửi xe đang hoạt động trùng lặp (IDs: ${sessionIds}). Yêu cầu kiểm tra và xử lý dữ liệu hành chính.`
        );
      }
      record = activeRecords[0];
    }

    if (!record) {
      throw new AppError(404, 'Không tìm thấy lượt đỗ xe đang hoạt động.');
    }
    if (record.checkOutTime !== null) {
      throw new AppError(409, 'Xe đã được Check-out trước đó.');
    }

    const now = new Date();
    const checkIn = new Date(record.checkInTime);
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = calcFee(
      checkIn,
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config
    );

    let depositCredit = 0;
    let bookingToUse = null;
    if (!record.isMonthly) {
      if (record.bookingId) {
        bookingToUse = await prisma.booking.findUnique({
          where: { id: record.bookingId },
        });
        if (bookingToUse && bookingToUse.status === 'FULFILLED' && bookingToUse.depositStatus === 'PAID' && bookingToUse.bookingDepositAppliedAt === null) {
          const paidPayment = await prisma.payment.findFirst({
            where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
          });
          if (paidPayment) {
            depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
          }
        }
      } else {
        bookingToUse = await prisma.booking.findFirst({
          where: {
            vehicleId: record.vehicleId,
            status: 'FULFILLED',
            depositStatus: 'PAID',
            bookingDepositAppliedAt: null,
          },
          orderBy: { bookingTime: 'desc' },
        });
        if (bookingToUse) {
          const paidPayment = await prisma.payment.findFirst({
            where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
          });
          if (paidPayment) {
            depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
          }
        }
      }
    }

    const finalAmountDue = Math.max(0, total - depositCredit);

    await prisma.$transaction(async (tx) => {
      // Concurrency lock
      await acquireVehicleOrPlateLock(tx, record.vehicleId, record.vehicle.plateNumber);

      const activeRecord = await tx.checkInRecord.findUnique({
        where: { id: record.id },
      });

      if (!activeRecord || activeRecord.checkOutTime !== null) {
        throw new AppError(409, 'Xe đã được Check-out trước đó.');
      }

      const updated = await tx.checkInRecord.updateMany({
        where: {
          id: record.id,
          checkOutTime: null,
        },
        data: {
          checkOutTime: now,
          checkedOutById: staffId,
          status: 'COMPLETED',
        },
      });

      if (updated.count === 0) {
        throw new AppError(409, 'Xe đã được check-out trước đó.');
      }

      if (!record.isMonthly && finalAmountDue > 0) {
        const existingPayment = await tx.payment.findFirst({
          where: {
            checkInRecordId: record.id,
            type: { in: ['SESSION', 'PARKING_FEE'] },
          },
        });
        if (existingPayment) {
          throw new AppError(409, 'Giao dịch thanh toán cho lượt gửi xe này đã được xử lý trước đó.');
        }
        await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            bookingId: null,
            monthlyPackageId: null,
            amount: finalAmountDue,
            method,
            type: 'PARKING_FEE',
            status: 'SUCCESS',
            paidAt: now,
            collectedById: staffId,
          },
        });
      }

      if (bookingToUse) {
        const updateResult = await tx.booking.updateMany({
          where: {
            id: bookingToUse.id,
            bookingDepositAppliedAt: null,
          },
          data: {
            bookingDepositAppliedAt: now,
            bookingDepositAppliedToSessionId: record.id,
          },
        });
        if (updateResult.count !== 1) {
          throw new AppError(409, 'Đặt cọc của booking này đã được áp dụng ở phiên khác hoặc không thể cập nhật.');
        }
      }

      if (record.slotId) {
        const updateData: { status: string; assignedVehicleId?: string | null } = {
          status: 'AVAILABLE',
        };
        if (record.isMonthly && record.slot?.assignedVehicleId) {
          updateData.status = 'RESERVED';
        } else if (!record.isMonthly && !record.slot?.isFixed) {
          updateData.assignedVehicleId = null;
        }
        await tx.parkingSlot.update({
          where: { id: record.slotId },
          data: updateData,
        });
      }
    });

    return {
      ok: true,
      plate: record.vehicle.plateNumber,
      slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      fee: record.isMonthly ? 0 : finalAmountDue,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
      grossParkingFee: record.isMonthly ? 0 : total,
      bookingDepositPaid: record.isMonthly ? 0 : depositCredit,
      amountDue: record.isMonthly ? 0 : finalAmountDue,
      checkInTime: record.checkInTime.toISOString(),
      durationMinutes: Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60_000),
      floorName: record.floor?.name ?? record.slot?.floor?.name ?? 'Không xác định',
      floorCode: record.floor?.floorCode ?? record.slot?.floor?.floorCode ?? '',
      paymentMethod: method,
    };
  },

  // ── POST /api/checkout/:checkInRecordId/stripe-session ───────────────────────────
  async createStripeSession(checkInRecordId: string, staffId: string): Promise<{ sessionId: string; checkoutUrl: string }> {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: checkInRecordId },
      include: {
        vehicle: true,
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
      },
    });

    if (!record) {
      throw new AppError(404, 'Không tìm thấy lượt gửi xe');
    }

    await prisma.$transaction(async (tx) => {
      await acquireVehicleOrPlateLock(tx, record.vehicleId, record.vehicle.plateNumber);
      const activeRec = await tx.checkInRecord.findUnique({ where: { id: checkInRecordId } });
      if (!activeRec || activeRec.checkOutTime !== null) {
        throw new AppError(409, 'Xe đã được Check-out trước đó.');
      }
    });

    if (record.checkOutTime !== null) {
      throw new AppError(409, 'Xe đã được Check-out trước đó.');
    }

    if (record.isMonthly) {
      throw new AppError(400, 'Xe sử dụng gói tháng không phát sinh phí cần thanh toán qua Stripe.');
    }

    const now = new Date();
    const config = await feeRuleService.getFeeConfig();
    const { total } = calcFee(
      new Date(record.checkInTime),
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config
    );

    let depositCredit = 0;
    let bookingToUse = null;
    if (record.bookingId) {
      bookingToUse = await prisma.booking.findUnique({
        where: { id: record.bookingId },
      });
      if (bookingToUse && bookingToUse.status === 'FULFILLED' && bookingToUse.depositStatus === 'PAID' && bookingToUse.bookingDepositAppliedAt === null) {
        const paidPayment = await prisma.payment.findFirst({
          where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
        });
        if (paidPayment) {
          depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
        }
      }
    } else {
      bookingToUse = await prisma.booking.findFirst({
        where: {
          vehicleId: record.vehicleId,
          status: 'FULFILLED',
          depositStatus: 'PAID',
          bookingDepositAppliedAt: null,
        },
        orderBy: { bookingTime: 'desc' },
      });
      if (bookingToUse) {
        const paidPayment = await prisma.payment.findFirst({
          where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
        });
        if (paidPayment) {
          depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
        }
      }
    }

    const finalAmountDue = Math.max(0, total - depositCredit);

    if (finalAmountDue <= 0) {
      throw new AppError(400, 'Số tiền thanh toán phải lớn hơn 0.');
    }

    // Check for existing pending CARD payments for this CheckInRecord atomically
    const payment = await prisma.$transaction(async (tx) => {
      // Concurrency lock
      await acquireVehicleOrPlateLock(tx, record.vehicleId, record.vehicle.plateNumber);

      const activeRec = await tx.checkInRecord.findUnique({ where: { id: checkInRecordId } });
      if (!activeRec || activeRec.checkOutTime !== null) {
        throw new AppError(409, 'Xe đã được Check-out trước đó.');
      }

      let existingPayment = await tx.payment.findFirst({
        where: {
          checkInRecordId: record.id,
          type: 'PARKING_FEE',
          method: 'CARD',
          status: 'PENDING',
        },
      });

      if (existingPayment) {
        existingPayment = await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: finalAmountDue,
            collectedById: staffId,
          },
        });
      } else {
        existingPayment = await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            bookingId: null,
            monthlyPackageId: null,
            amount: finalAmountDue,
            method: 'CARD',
            type: 'PARKING_FEE',
            status: 'PENDING',
            collectedById: staffId,
          },
        });
      }
      return existingPayment;
    });

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new AppError(500, 'FRONTEND_URL environment variable is not configured.');
    }

    const session = await stripe.checkout.sessions.create({
      success_url: `${frontendUrl}/staff/checkout?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/staff/checkout?stripe=cancelled`,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name: `Phí gửi xe ParkSmart - ${record.vehicle.plateNumber}`,
              description: `Phí gửi xe tại tầng ${record.floor?.name ?? record.slot?.floor?.name ?? 'Không xác định'}`,
            },
            unit_amount: finalAmountDue,
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentPurpose: 'PARKING_FEE',
        paymentType: 'PARKING_FEE',
        paymentId: payment.id,
        checkInRecordId: record.id,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        transactionCode: session.id,
      },
    });

    return {
      sessionId: session.id,
      checkoutUrl: session.url ?? '',
    };
  },

  // ── GET /api/checkout/:checkInRecordId/stripe-status ─────────────────────────────
  async getStripeStatus(checkInRecordId: string): Promise<{
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    checkInRecordStatus: string;
    receipt?: CheckoutSubmitResult;
  }> {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: checkInRecordId },
      include: {
        vehicle: true,
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
      },
    });

    if (!record) {
      throw new AppError(404, 'Không tìm thấy lượt gửi xe');
    }

    const payment = await prisma.payment.findFirst({
      where: {
        checkInRecordId: record.id,
        type: 'PARKING_FEE',
        method: 'CARD',
      },
      orderBy: { createdAt: 'desc' },
    });

    const status = (payment?.status as 'PENDING' | 'SUCCESS' | 'FAILED' | undefined) ?? 'PENDING';

    if (status === 'SUCCESS' && record.status === 'COMPLETED' && record.checkOutTime) {
      const durationMinutes = Math.round((record.checkOutTime.getTime() - record.checkInTime.getTime()) / 60_000);
      const floorName = record.floor?.name ?? record.slot?.floor?.name ?? 'Không xác định';
      const floorCode = record.floor?.floorCode ?? record.slot?.floor?.floorCode ?? '';

      let bookingDepositPaid = 0;
      if (record.bookingId) {
        const booking = await prisma.booking.findUnique({
          where: { id: record.bookingId },
        });
        if (booking && booking.bookingDepositAppliedAt) {
          bookingDepositPaid = parseFloat(String(booking.depositAmount)) || 0;
        }
      } else {
        const booking = await prisma.booking.findFirst({
          where: {
            vehicleId: record.vehicleId,
            bookingDepositAppliedToSessionId: record.id,
          },
        });
        if (booking) {
          bookingDepositPaid = parseFloat(String(booking.depositAmount)) || 0;
        }
      }

      if (!payment) {
        throw new AppError(
          404,
          'Không tìm thấy giao dịch thanh toán Stripe cho lượt gửi xe này.'
        );
      }

      const paymentAmount = Number(payment.amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
        throw new AppError(500, 'Số tiền thanh toán không hợp lệ.');
      }

      const grossParkingFee = paymentAmount + bookingDepositPaid;

      const receipt: CheckoutSubmitResult = {
        ok: true,
        plate: record.vehicle.plateNumber,
        slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
        fee: paymentAmount,
        isMonthly: record.isMonthly,
        checkOutTime: record.checkOutTime.toISOString(),
        grossParkingFee,
        bookingDepositPaid,
        amountDue: paymentAmount,
        checkInTime: record.checkInTime.toISOString(),
        durationMinutes,
        floorName,
        floorCode,
        paymentMethod: 'CARD',
      };

      return {
        status: 'SUCCESS',
        checkInRecordStatus: record.status,
        receipt,
      };
    }

    return {
      status,
      checkInRecordStatus: record.status,
    };
  },

  // ── GET /api/checkout/stripe-status?session_id=... ─────────────────────────────
  async getStripeStatusBySession(sessionId: string): Promise<{
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    checkInRecordStatus: string;
    receipt?: CheckoutSubmitResult;
  }> {
    const payment = await prisma.payment.findUnique({
      where: { transactionCode: sessionId },
      include: {
        checkInRecord: {
          include: {
            vehicle: true,
            slot: {
              include: {
                floor: true,
              },
            },
            floor: true,
          },
        },
      },
    });

    if (!payment) {
      throw new AppError(404, 'Không tìm thấy thông tin giao dịch');
    }

    const record = payment.checkInRecord;
    if (!record) {
      throw new AppError(404, 'Không tìm thấy lượt gửi xe liên quan');
    }

    const status = (payment.status as 'PENDING' | 'SUCCESS' | 'FAILED' | undefined) ?? 'PENDING';

    if (status === 'SUCCESS' && record.status === 'COMPLETED' && record.checkOutTime) {
      const durationMinutes = Math.round((record.checkOutTime.getTime() - record.checkInTime.getTime()) / 60_000);
      const floorName = record.floor?.name ?? record.slot?.floor?.name ?? 'Không xác định';
      const floorCode = record.floor?.floorCode ?? record.slot?.floor?.floorCode ?? '';

      let bookingDepositPaid = 0;
      if (record.bookingId) {
        const booking = await prisma.booking.findUnique({
          where: { id: record.bookingId },
        });
        if (booking && booking.bookingDepositAppliedAt) {
          bookingDepositPaid = parseFloat(String(booking.depositAmount)) || 0;
        }
      } else {
        const booking = await prisma.booking.findFirst({
          where: {
            vehicleId: record.vehicleId,
            bookingDepositAppliedToSessionId: record.id,
          },
        });
        if (booking) {
          bookingDepositPaid = parseFloat(String(booking.depositAmount)) || 0;
        }
      }

      const grossParkingFee = parseFloat(String(payment.amount)) + bookingDepositPaid;

      const receipt: CheckoutSubmitResult = {
        ok: true,
        plate: record.vehicle.plateNumber,
        slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
        fee: parseFloat(String(payment.amount)),
        isMonthly: record.isMonthly,
        checkOutTime: record.checkOutTime.toISOString(),
        grossParkingFee,
        bookingDepositPaid,
        amountDue: parseFloat(String(payment.amount)),
        checkInTime: record.checkInTime.toISOString(),
        durationMinutes,
        floorName,
        floorCode,
        paymentMethod: 'CARD',
      };

      return {
        status: 'SUCCESS',
        checkInRecordStatus: record.status,
        receipt,
      };
    }

    return {
      status,
      checkInRecordStatus: record.status,
    };
  },

  // ── Webhook processing for PARKING_FEE ───────────────────────────────────────────
  async handleStripeWebhook(event: Stripe.Event): Promise<{ success: boolean; alreadyProcessed: boolean }> {
    if (event.type !== 'checkout.session.completed') {
      return { success: true, alreadyProcessed: true };
    }
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session) throw new AppError(400, 'Invalid Stripe webhook object format.');

    const metadata = session.metadata;
    if (!metadata || metadata.paymentPurpose !== 'PARKING_FEE') {
      throw new AppError(400, 'Invalid metadata payment purpose.');
    }

    const paymentId = metadata.paymentId;
    const checkInRecordId = metadata.checkInRecordId;

    if (!paymentId || !checkInRecordId) {
      throw new AppError(400, 'Missing required paymentId or checkInRecordId in metadata.');
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (true) {
      attempts++;
      try {
        const result = await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.findUnique({
            where: { id: paymentId },
          });
          const record = await tx.checkInRecord.findUnique({
            where: { id: checkInRecordId },
          });

          if (!payment) throw new AppError(404, 'Không tìm thấy thanh toán.');
          if (!record) throw new AppError(404, 'Không tìm thấy lượt gửi xe.');

          if (payment.status === 'SUCCESS' && record.checkOutTime !== null && record.status === 'COMPLETED') {
            return { success: true, alreadyProcessed: true };
          }

          if (payment.type !== 'PARKING_FEE') {
            throw new AppError(400, 'Invalid payment type.');
          }
          if (payment.checkInRecordId !== record.id) {
            throw new AppError(400, 'Payment record mismatch.');
          }
          if (session.payment_status !== 'paid') {
            throw new AppError(400, 'Session has not been paid.');
          }

          const stripeAmount = session.amount_total;
          const dbAmount = Math.round(parseFloat(String(payment.amount)));

          if (session.currency?.toLowerCase() !== 'vnd') {
            throw new AppError(400, `Invalid currency: expected VND, got ${session.currency}`);
          }
          if (stripeAmount !== dbAmount) {
            throw new AppError(400, `Invalid payment amount: expected ${dbAmount}, got ${stripeAmount}`);
          }

          const now = new Date();

          let bookingToUse = null;
          if (!record.isMonthly) {
            if (record.bookingId) {
              bookingToUse = await tx.booking.findUnique({
                where: { id: record.bookingId },
              });
              if (bookingToUse && bookingToUse.status === 'FULFILLED' && bookingToUse.depositStatus === 'PAID' && bookingToUse.bookingDepositAppliedAt === null) {
                const paidPayment = await tx.payment.findFirst({
                  where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
                });
                if (!paidPayment) {
                  bookingToUse = null;
                }
              } else {
                bookingToUse = null;
              }
            } else {
              bookingToUse = await tx.booking.findFirst({
                where: {
                  vehicleId: record.vehicleId,
                  status: 'FULFILLED',
                  depositStatus: 'PAID',
                  bookingDepositAppliedAt: null,
                },
                orderBy: { bookingTime: 'desc' },
              });
              if (bookingToUse) {
                const paidPayment = await tx.payment.findFirst({
                  where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
                });
                if (!paidPayment) {
                  bookingToUse = null;
                }
              }
            }
          }

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCESS',
              paidAt: now,
              transactionCode: session.id,
            },
          });

          if (bookingToUse) {
            const updateResult = await tx.booking.updateMany({
              where: {
                id: bookingToUse.id,
                bookingDepositAppliedAt: null,
              },
              data: {
                bookingDepositAppliedAt: now,
                bookingDepositAppliedToSessionId: record.id,
              },
            });
            if (updateResult.count !== 1) {
              throw new AppError(409, 'Đặt cọc của booking này đã được áp dụng ở phiên khác hoặc không thể cập nhật.');
            }
          }

          const checkInRecordUpdateResult = await tx.checkInRecord.updateMany({
            where: {
              id: record.id,
              checkOutTime: null,
            },
            data: {
              checkOutTime: now,
              checkedOutById: payment.collectedById,
              status: 'COMPLETED',
            },
          });

          if (checkInRecordUpdateResult.count === 0) {
            throw new AppError(409, 'Lượt gửi xe đã được check-out trước đó.');
          }

          if (record.slotId) {
            const slot = await tx.parkingSlot.findUnique({
              where: { id: record.slotId },
            });
            const updateData: { status: string; assignedVehicleId?: string | null } = {
              status: 'AVAILABLE',
            };
            if (record.isMonthly && slot?.assignedVehicleId) {
              updateData.status = 'RESERVED';
            } else if (!record.isMonthly && !slot?.isFixed) {
              updateData.assignedVehicleId = null;
            }
            await tx.parkingSlot.update({
              where: { id: record.slotId },
              data: updateData,
            });
          }

          return { success: true, alreadyProcessed: false };
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        return result;
      } catch (err: any) {
        if (err.code === 'P2034' && attempts < maxAttempts) {
          await new Promise(res => setTimeout(res, attempts * 100));
          continue;
        }
        if (err.code === 'P2002' && err.meta?.target?.includes('transactionCode')) {
          return { success: true, alreadyProcessed: true };
        }
        throw err;
      }
    }
  },
};
