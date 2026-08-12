import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { monthlyPackageService } from './monthlyPackage.service';
import { calcFee } from '../utils/fee';
import { feeRuleService } from './feeRule.service';
import { Prisma } from '@prisma/client';
import { stripe } from '../config/stripe';
import Stripe from 'stripe';
import { acquireVehicleOrPlateLock, getVehicleOperationalState } from '../utils/vehicleState';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { config as appConfig } from '../config';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { recognizeLicensePlate } from './ocr.service';
import { normalizeLicensePlate } from '../utils/plate';

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
  floorId?: number | null;
  floorName?: string | null;
  floorCode?: string | null;
  allowedTier?: string | null;
  bookingId?: string | null;
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
  totalSuccessfullyPaid?: number;
  prepaidAt?: string | null;
  graceExpiresAt?: string | null;
  frontImageUrl?: string | null;
  rearImageUrl?: string | null;
  driverCheckInImageUrl?: string | null;
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
  totalSuccessfullyPaid: number;
  amountDue: number;
  checkInTime: string;
  durationMinutes: number;
  floorName: string;
  floorCode: string;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
}

type CheckInRecordWithRelations = Prisma.CheckInRecordGetPayload<{
  include: {
    vehicle: {
      include: {
        owner: {
          select: {
            fullName: true;
            phoneNumber: true;
            email: true;
          };
        };
      };
    };
    slot: {
      include: {
        floor: true;
      };
    };
    floor: true;
    payments: true;
    guestCredential: true;
  };
}>;

async function mapRecordToLookupResult(
  record: CheckInRecordWithRelations,
  now: Date,
  isMonthlyOverride: boolean
): Promise<CheckoutLookupResult> {
  const vehicle = record.vehicle;
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
  if (!isMonthlyOverride) {
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

  const totalSuccessfullyPaid = record.payments?.reduce((sum, p) => sum + (p.status === 'SUCCESS' && p.type === 'PARKING_FEE' ? parseFloat(String(p.amount)) : 0), 0) ?? 0;
  let amountDue = Math.max(0, total - depositCredit - totalSuccessfullyPaid);
  let graceExpiresAt = null;
  if (record.prepaidAt) {
    graceExpiresAt = new Date(new Date(record.prepaidAt).getTime() + 300 * 1000);
    if (now <= graceExpiresAt) {
      amountDue = 0;
    }
  }

  let packageExpiry: string | undefined;
  if (isMonthlyOverride) {
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
    floorId: record.floor?.id ?? record.slot?.floor?.id ?? record.floorId ?? null,
    floorName: record.floor?.name ?? record.slot?.floor?.name ?? null,
    floorCode: record.floor?.floorCode ?? record.slot?.floor?.floorCode ?? null,
    allowedTier: record.allowedTier ?? null,
    bookingId: record.bookingId ?? null,
    isMonthly: isMonthlyOverride,
    checkInTime: record.checkInTime.toISOString(),
    now: now.toISOString(),
    durationMinutes,
    fee: isMonthlyOverride ? 0 : amountDue,
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
    grossParkingFee: isMonthlyOverride ? 0 : total,
    bookingDepositPaid: isMonthlyOverride ? 0 : depositCredit,
    amountDue: isMonthlyOverride ? 0 : amountDue,
    frontImageUrl: resolveCheckInImageUrl(record.frontImageUrl),
    rearImageUrl: resolveCheckInImageUrl(record.rearImageUrl),
    driverCheckInImageUrl: resolveCheckInImageUrl(record.driverCheckInImageUrl),
    isLegacy,
    totalSuccessfullyPaid,
    prepaidAt: record.prepaidAt ? record.prepaidAt.toISOString() : null,
    graceExpiresAt: graceExpiresAt ? graceExpiresAt.toISOString() : null,
  };
}

async function verifyExitVehiclePlate(
  rearBuffer: Buffer,
  vehicleType: 'CAR' | 'MOTORBIKE',
  activePlateNumber: string,
  manualPlate?: string
): Promise<{ method: 'OCR' | 'MANUAL'; verifiedPlate: string }> {
  let ocrResult: any = null;
  try {
    ocrResult = await recognizeLicensePlate(rearBuffer, vehicleType);
  } catch {
    ocrResult = null;
  }

  const detectedNormalizedPlate = normalizeLicensePlate(
    ocrResult?.normalizedPlate || ocrResult?.bestPlate || ''
  );
  const activeRecordPlateNormalized = normalizeLicensePlate(activePlateNumber);

  if (detectedNormalizedPlate) {
    // Case A: OCR MATCH
    if (detectedNormalizedPlate === activeRecordPlateNormalized) {
      return { method: 'OCR', verifiedPlate: detectedNormalizedPlate };
    }
    // Case C: OCR READS A DIFFERENT VALID PLATE
    if (!manualPlate || !manualPlate.trim()) {
      throw new AppError(
        400,
        'Biển số xe lúc ra không khớp với phiên gửi xe hiện tại. Không thể cho xe ra bãi.'
      );
    }
  } else {
    // Case B: OCR UNREADABLE -> controlled manual fallback
    if (!manualPlate || !manualPlate.trim()) {
      throw new AppError(
        422,
        'Không thể xác minh biển số xe lúc ra. Vui lòng chụp lại ảnh phía sau rõ biển số.'
      );
    }
  }

  const normalizedManualPlate = normalizeLicensePlate(manualPlate);
  if (!normalizedManualPlate) {
    throw new AppError(400, 'Biển số nhập thủ công không hợp lệ.');
  }

  if (normalizedManualPlate !== activeRecordPlateNormalized) {
    throw new AppError(400, 'Biển số nhập thủ công không khớp với phiên gửi xe hiện tại.');
  }

  return { method: 'MANUAL', verifiedPlate: normalizedManualPlate };
}

async function validateVerification(verificationId: string, record: any) {
  const verification = await prisma.checkoutVerification.findUnique({
    where: { id: verificationId }
  });

  if (!verification) {
    throw new AppError(400, 'Mã xác minh không tồn tại. Vui lòng xác minh xe lại.');
  }

  if (verification.checkInRecordId !== record.id) {
    throw new AppError(400, 'Mã xác minh không khớp với lượt gửi xe hiện tại.');
  }

  if (new Date(verification.expiresAt).getTime() <= Date.now()) {
    throw new AppError(400, 'Xác minh xe lúc ra đã hết hạn. Vui lòng thực hiện xác minh lại.');
  }

  if (record.status !== 'PARKING') {
    throw new AppError(400, 'Lượt gửi xe đã hoàn thành hoặc không còn hoạt động.');
  }

  const activePlateNorm = normalizeLicensePlate(record.vehicle.plateNumber);
  const verifiedPlateNorm = normalizeLicensePlate(verification.normalizedPlate);
  if (verifiedPlateNorm !== activePlateNorm) {
    throw new AppError(400, 'Biển số xe hiện tại không khớp với biển số đã xác minh.');
  }

  if (verification.vehicleType !== record.vehicle.type) {
    throw new AppError(400, 'Loại xe hiện tại không khớp với loại xe đã xác minh.');
  }

  // Stale/replay protection: determine the newest successful CheckoutVerification for this record
  const newestVerification = await prisma.checkoutVerification.findFirst({
    where: { checkInRecordId: record.id },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' } // deterministic secondary ordering
    ]
  });

  if (!newestVerification || newestVerification.id !== verificationId) {
    throw new AppError(400, 'Mã xác minh đã hết hạn hoặc bị thay thế bởi lượt xác minh mới hơn. Vui lòng xác minh xe lại.');
  }

  return verification;
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
        payments: true,
        guestCredential: true,
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
    return mapRecordToLookupResult(record, new Date(), record.isMonthly);
  },

  // ── POST /api/checkout/lookup-by-pin ─────────────────────
  async lookupByPin(pin: string): Promise<CheckoutLookupResult & { credentialType: 'GUEST_PIN' | 'MONTHLY_PIN' }> {
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new AppError(400, 'Mã PIN không hợp lệ. Phải gồm đúng 6 chữ số.');
    }

    const now = new Date();

    // 1. Guest PIN candidates
    const guestRecords = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        status: 'PARKING',
        guestCredential: {
          pin: pin,
          active: true
        }
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
        payments: true,
        guestCredential: true,
      }
    });

    // 2. Monthly PIN candidates
    const monthlyRecords = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        status: 'PARKING',
        vehicle: {
          isMonthly: true,
          monthlyPackage: {
            monthlyAccessPin: pin,
            status: 'ACTIVE',
            expiryDate: {
              gt: now
            }
          }
        }
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
        payments: true,
        guestCredential: true,
      }
    });

    // Deduplicate candidates by CheckInRecord ID
    const seenIds = new Set<string>();
    const candidates: { record: CheckInRecordWithRelations; type: 'GUEST_PIN' | 'MONTHLY_PIN' }[] = [];

    for (const record of guestRecords) {
      if (!seenIds.has(record.id)) {
        seenIds.add(record.id);
        candidates.push({ record, type: 'GUEST_PIN' });
      }
    }

    for (const record of monthlyRecords) {
      const isAlreadyGuest = seenIds.has(record.id);
      if (isAlreadyGuest) {
        throw new AppError(409, 'Mã PIN trùng với nhiều phiên gửi xe. Vui lòng sử dụng mã QR hoặc tra cứu biển số.');
      }
      seenIds.add(record.id);
      candidates.push({ record, type: 'MONTHLY_PIN' });
    }

    if (candidates.length === 0) {
      throw new AppError(404, 'Mã PIN không hợp lệ, đã hết hạn hoặc không có phiên gửi xe đang hoạt động.');
    }

    if (candidates.length > 1) {
      throw new AppError(
        409,
        'Mã PIN trùng với nhiều phiên gửi xe. Vui lòng sử dụng mã QR hoặc tra cứu biển số.'
      );
    }

    const { record, type } = candidates[0];

    const result = await mapRecordToLookupResult(record, now, type === 'MONTHLY_PIN');
    return {
      ...result,
      credentialType: type
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
    totalSuccessfullyPaid?: number;
    prepaidAt?: string | null;
    graceExpiresAt?: string | null;
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
        payments: true,
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

    const totalSuccessfullyPaid = record.payments?.reduce((sum, p) => sum + (p.status === 'SUCCESS' && p.type === 'PARKING_FEE' ? parseFloat(String(p.amount)) : 0), 0) ?? 0;
    let amountDue = Math.max(0, total - depositCredit - totalSuccessfullyPaid);
    let graceExpiresAt = null;
    if (record.prepaidAt) {
      graceExpiresAt = new Date(new Date(record.prepaidAt).getTime() + 300 * 1000);
      if (now <= graceExpiresAt) {
        amountDue = 0;
      }
    }

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
      totalSuccessfullyPaid,
      prepaidAt: record.prepaidAt ? record.prepaidAt.toISOString() : null,
      graceExpiresAt: graceExpiresAt ? graceExpiresAt.toISOString() : null,
    };
  },

  // ── POST /api/checkout ───────────────────────────────────
  async submit(params: {
    checkInRecordId?: string;
    plate?: string;
    method?: 'CASH' | 'CARD' | 'EWALLET';
    staffId?: string;
    pin?: string;
    monthlyQrToken?: string;
    manualCheckoutPlate?: string;
    frontCheckOutFile?: Express.Multer.File;
    rearCheckOutFile?: Express.Multer.File;
    driverCheckOutFile?: Express.Multer.File;
    verificationId?: string;
  }): Promise<CheckoutSubmitResult> {
    const {
      checkInRecordId,
      plate,
      method = 'CASH',
      staffId,
      pin,
      monthlyQrToken,
      manualCheckoutPlate,
      frontCheckOutFile,
      rearCheckOutFile,
      driverCheckOutFile,
      verificationId,
    } = params;

    if (!['CASH', 'CARD', 'EWALLET'].includes(method)) {
      throw new AppError(400, 'Phương thức thanh toán không hợp lệ.');
    }

    if (!verificationId) {
      if (!frontCheckOutFile) {
        throw new AppError(400, 'Vui lòng chụp ảnh phía trước xe lúc ra.');
      }
      if (!rearCheckOutFile) {
        throw new AppError(400, 'Vui lòng chụp ảnh phía sau xe lúc ra.');
      }
      if (!driverCheckOutFile) {
        throw new AppError(400, 'Vui lòng chụp ảnh người nhận xe.');
      }
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
          payments: true,
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
          payments: true,
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

    let frontUrl: string | undefined;
    let frontPublicId: string | undefined;
    let rearUrl: string | undefined;
    let rearPublicId: string | undefined;
    let driverUrl: string | undefined;
    let driverPublicId: string | undefined;
    let verificationMethod: string = 'OCR';

    if (verificationId) {
      const verification = await validateVerification(verificationId, record);
      frontUrl = verification.frontCheckOutImageUrl;
      frontPublicId = verification.frontCheckOutImagePublicId;
      rearUrl = verification.rearCheckOutImageUrl;
      rearPublicId = verification.rearCheckOutImagePublicId;
      driverUrl = verification.driverCheckOutImageUrl;
      driverPublicId = verification.driverCheckOutImagePublicId;
      verificationMethod = verification.verificationMethod;
    } else {
      // ── Rear License Plate OCR / Controlled Manual Verification (Hard Security Gate) ──
      const vehicleType = (record.vehicle?.type === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR') as 'CAR' | 'MOTORBIKE';
      const { method: vMethod } = await verifyExitVehiclePlate(
        rearCheckOutFile!.buffer,
        vehicleType,
        record.vehicle.plateNumber,
        manualCheckoutPlate
      );
      verificationMethod = vMethod;

      // ── Upload Checkout Images to Cloudinary ──
      try {
        const frontUpload = await uploadBufferToCloudinary(frontCheckOutFile!.buffer);
        frontUrl = frontUpload.secureUrl;
        frontPublicId = frontUpload.publicId;

        const rearUpload = await uploadBufferToCloudinary(rearCheckOutFile!.buffer);
        rearUrl = rearUpload.secureUrl;
        rearPublicId = rearUpload.publicId;

        const driverUpload = await uploadBufferToCloudinary(driverCheckOutFile!.buffer);
        driverUrl = driverUpload.secureUrl;
        driverPublicId = driverUpload.publicId;
      } catch (uploadError) {
        if (frontPublicId) await deleteFromCloudinary(frontPublicId).catch(() => {});
        if (rearPublicId) await deleteFromCloudinary(rearPublicId).catch(() => {});
        if (driverPublicId) await deleteFromCloudinary(driverPublicId).catch(() => {});
        throw uploadError;
      }
    }

    const config = await feeRuleService.getFeeConfig();

    let txResult: any;
    try {
      // ── Use a structured transaction result (Option B) so all authoritative
      //    financial variables and record properties are returned from inside the transaction,
      //    guaranteeing no reliance on any potentially stale record state loaded before lock.
      txResult = await prisma.$transaction(async (tx) => {
        // Concurrency lock — blocks a concurrent duplicate Checkout for the same vehicle
        await acquireVehicleOrPlateLock(tx, record.vehicleId, record.vehicle.plateNumber);

        // Reload the visit, its payments, slot, and floor from the authoritative DB state inside the tx
        const activeRecord = await tx.checkInRecord.findUnique({
          where: { id: record.id },
          include: {
            vehicle: true,
            payments: true,
            slot: {
              include: {
                floor: true,
              },
            },
            floor: true,
          },
        });

        if (!activeRecord || activeRecord.checkOutTime !== null) {
          throw new AppError(409, 'Xe đã được Check-out trước đó.');
        }

        // Authoritative checkout timestamp — used for fee calculation and all mutations
        const now = new Date();
        const checkIn = new Date(activeRecord.checkInTime);
        let isMonthlyOverride = false;
        const requiresMonthlyCreds = activeRecord.isMonthly || (pin !== undefined && pin !== '') || (monthlyQrToken !== undefined && monthlyQrToken !== '');

        if (requiresMonthlyCreds) {
          if (!pin && !monthlyQrToken) {
            throw new AppError(400, 'Checkout xe tháng yêu cầu mã PIN hoặc mã QR gói tháng.');
          }
          if (pin && monthlyQrToken) {
            throw new AppError(400, 'Vui lòng chỉ cung cấp một phương thức xác thực: mã PIN hoặc mã QR.');
          }

          if (pin) {
            await monthlyPackageService.verifyMonthlyPackageAccessByPin(activeRecord.vehicle.plateNumber, pin, tx);
            isMonthlyOverride = true;
          } else if (monthlyQrToken) {
            let decoded: any;
            try {
              decoded = jwt.verify(monthlyQrToken, appConfig.jwtSecret, {
                issuer: 'smart-parking-backend',
                audience: 'smart-parking-checkout',
                algorithms: ['HS256'],
              });
            } catch (err) {
              throw new AppError(400, 'Mã QR gói tháng không hợp lệ hoặc đã hết hạn.');
            }

            if (!decoded || decoded.purpose !== 'MONTHLY_CHECKOUT_QR' || !decoded.packageId || !decoded.vehicleId) {
              throw new AppError(400, 'Mã QR gói tháng không hợp lệ.');
            }

            const pkg = await tx.monthlyPackage.findUnique({
              where: { id: decoded.packageId },
              include: { vehicle: true },
            });

            if (!pkg) {
              throw new AppError(404, 'Gói tháng của mã QR không tồn tại.');
            }

            if (pkg.status !== 'ACTIVE' || pkg.expiryDate.getTime() <= now.getTime() || pkg.startDate.getTime() > now.getTime()) {
              throw new AppError(400, 'Gói tháng đã hết hạn hoặc không còn hiệu lực.');
            }

            if (pkg.vehicleId !== decoded.vehicleId || !pkg.vehicle) {
              throw new AppError(400, 'Thông tin xe trong mã QR không khớp.');
            }

            if (activeRecord.vehicleId !== pkg.vehicleId) {
              throw new AppError(400, 'Mã QR không trùng khớp với xe đang thực hiện Checkout.');
            }

            isMonthlyOverride = true;
          }
        } else {
          if (pin || monthlyQrToken) {
            throw new AppError(400, 'Mã PIN hoặc QR gói tháng không hợp lệ cho lượt gửi xe vãng lai hoặc đặt trước.');
          }
        }

        const isMonthlyEffective = activeRecord.isMonthly || isMonthlyOverride;

        const { total, breakdown } = calcFee(
          checkIn,
          now,
          activeRecord.vehicle.type as 'CAR' | 'MOTORBIKE',
          config
        );

        let depositCredit = 0;
        let bookingToUse = null;
        if (!isMonthlyEffective) {
          if (activeRecord.bookingId) {
            bookingToUse = await tx.booking.findUnique({
              where: { id: activeRecord.bookingId },
            });
            if (bookingToUse && bookingToUse.status === 'FULFILLED' && bookingToUse.depositStatus === 'PAID' && bookingToUse.bookingDepositAppliedAt === null) {
              const paidPayment = await tx.payment.findFirst({
                where: { bookingId: bookingToUse.id, status: 'SUCCESS', type: { in: ['BOOKING_FEE', 'BOOKING_DEPOSIT'] } },
              });
              if (paidPayment) {
                depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
              }
            }
          } else {
            bookingToUse = await tx.booking.findFirst({
              where: {
                vehicleId: activeRecord.vehicleId,
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
              if (paidPayment) {
                depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
              }
            }
          }
        }

        // Authoritative sum of all successful PARKING_FEE payments for this visit so far
        const totalSuccessfullyPaidBefore = activeRecord.payments?.reduce(
          (sum, p) => sum + (p.status === 'SUCCESS' && p.type === 'PARKING_FEE' ? parseFloat(String(p.amount)) : 0), 0
        ) ?? 0;

        // Outstanding balance after crediting all prior payments and booking deposit
        let finalAmountDue = isMonthlyEffective ? 0 : Math.max(0, total - depositCredit - totalSuccessfullyPaidBefore);

        // Five-minute grace period: no additional collection if prepayment is still active
        if (activeRecord.prepaidAt) {
          const graceExpiresAt = new Date(new Date(activeRecord.prepaidAt).getTime() + 300 * 1000);
          if (now <= graceExpiresAt) {
            finalAmountDue = 0;
          }
        }

        const updated = await tx.checkInRecord.updateMany({
          where: {
            id: activeRecord.id,
            checkOutTime: null,
          },
          data: {
            checkOutTime: now,
            checkedOutById: staffId,
            status: 'COMPLETED',
            isMonthly: isMonthlyEffective ? true : undefined,
            frontCheckOutImageUrl: frontUrl,
            frontCheckOutImagePublicId: frontPublicId,
            rearCheckOutImageUrl: rearUrl,
            rearCheckOutImagePublicId: rearPublicId,
            driverCheckOutImageUrl: driverUrl,
            driverCheckOutImagePublicId: driverPublicId,
          },
        });

        await tx.guestAccessCredential.updateMany({
          where: {
            checkInRecordId: activeRecord.id,
            active: true,
          },
          data: {
            active: false,
            revokedAt: now,
          },
        });

        if (updated.count === 0) {
          // The concurrent duplicate path: lock was released, other tx already committed
          throw new AppError(409, 'Xe đã được check-out trước đó.');
        }

        // Create a manual payment only when there is a genuinely outstanding balance.
        // A concurrent duplicate Checkout would have been caught above (checkOutTime already set).
        // An already-paid balance produces finalAmountDue = 0 → no Payment created.
        if (!activeRecord.isMonthly && finalAmountDue > 0) {
          await tx.payment.create({
            data: {
              checkInRecordId: activeRecord.id,
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
              bookingDepositAppliedToSessionId: activeRecord.id,
            },
          });
          if (updateResult.count !== 1) {
            throw new AppError(409, 'Đặt cọc của booking này đã được áp dụng ở phiên khác hoặc không thể cập nhật.');
          }
        }

        if (activeRecord.slotId) {
          const updateData: { status: string; assignedVehicleId?: string | null } = {
            status: 'AVAILABLE',
          };
          if (activeRecord.isMonthly && activeRecord.slot?.assignedVehicleId) {
            updateData.status = 'RESERVED';
          } else if (!activeRecord.isMonthly && !activeRecord.slot?.isFixed) {
            updateData.assignedVehicleId = null;
          }
          await tx.parkingSlot.update({
            where: { id: activeRecord.slotId },
            data: updateData,
          });
        }

        // Authoritative sum of all successful PARKING_FEE payments for this visit after mutations
        const totalPaidDb = await tx.payment.aggregate({
          _sum: { amount: true },
          where: {
            checkInRecordId: activeRecord.id,
            type: 'PARKING_FEE',
            status: 'SUCCESS',
          },
        });
        const postTotalSuccessfullyPaid = Number(totalPaidDb._sum.amount ?? 0);

        // Return all authoritative values so the caller can build the response
        // without referencing variables that were computed inside the transaction callback
        // or using any stale data loaded before the transaction.
        return {
          now,
          breakdown,
          total,
          depositCredit,
          totalSuccessfullyPaid: postTotalSuccessfullyPaid,
          finalAmountDue,
          isMonthly: activeRecord.isMonthly,
          checkInTime: activeRecord.checkInTime,
          plateNumber: activeRecord.vehicle.plateNumber,
          slotCode: activeRecord.slot?.code ?? (activeRecord.allowedTier ? `Khu ${activeRecord.allowedTier === 'VIP' ? 'VIP' : activeRecord.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
          floorName: activeRecord.floor?.name ?? activeRecord.slot?.floor?.name ?? 'Không xác định',
          floorCode: activeRecord.floor?.floorCode ?? activeRecord.slot?.floor?.floorCode ?? '',
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (txError) {
      if (!verificationId) {
        if (frontPublicId) await deleteFromCloudinary(frontPublicId).catch(() => {});
        if (rearPublicId) await deleteFromCloudinary(rearPublicId).catch(() => {});
        if (driverPublicId) await deleteFromCloudinary(driverPublicId).catch(() => {});
      }
      throw txError;
    }

    const {
      now,
      breakdown,
      total,
      depositCredit,
      totalSuccessfullyPaid,
      finalAmountDue,
      isMonthly,
      checkInTime,
      plateNumber,
      slotCode,
      floorName,
      floorCode,
    } = txResult;

    return {
      ok: true,
      plate: plateNumber,
      slotCode,
      fee: isMonthly ? 0 : finalAmountDue,
      isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
      grossParkingFee: isMonthly ? 0 : total,
      bookingDepositPaid: isMonthly ? 0 : depositCredit,
      totalSuccessfullyPaid: isMonthly ? 0 : totalSuccessfullyPaid,
      amountDue: isMonthly ? 0 : finalAmountDue,
      checkInTime: checkInTime.toISOString(),
      durationMinutes: Math.round((now.getTime() - checkInTime.getTime()) / 60_000),
      floorName,
      floorCode,
      paymentMethod: method,
    };
  },

  // ── POST /api/checkout/:checkInRecordId/verify-exit ──────────────────────────────
  async verifyExit(
    checkInRecordId: string,
    files?: {
      frontCheckOutFile?: Express.Multer.File;
      rearCheckOutFile?: Express.Multer.File;
      driverCheckOutFile?: Express.Multer.File;
    },
    manualCheckoutPlate?: string
  ): Promise<{ verificationId: string; expiresAt: string; verifiedPlate: string; verificationMethod: string }> {
    const startTime = Date.now();

    if (!files?.frontCheckOutFile) {
      throw new AppError(400, 'Vui lòng chụp ảnh phía trước xe lúc ra.');
    }
    if (!files?.rearCheckOutFile) {
      throw new AppError(400, 'Vui lòng chụp ảnh phía sau xe lúc ra.');
    }
    if (!files?.driverCheckOutFile) {
      throw new AppError(400, 'Vui lòng chụp ảnh người nhận xe.');
    }

    const record = await prisma.checkInRecord.findUnique({
      where: { id: checkInRecordId },
      include: {
        vehicle: true,
      },
    });

    if (!record) {
      throw new AppError(404, 'Không tìm thấy lượt gửi xe.');
    }

    if (record.status !== 'PARKING' || record.checkOutTime !== null) {
      throw new AppError(400, 'Lượt gửi xe đã hoàn thành hoặc không còn hoạt động.');
    }

    // 1. Existing plate verification
    const ocrStart = Date.now();
    const vehicleType = (record.vehicle?.type === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR') as 'CAR' | 'MOTORBIKE';
    const verificationResult = await verifyExitVehiclePlate(
      files.rearCheckOutFile.buffer,
      vehicleType,
      record.vehicle.plateNumber,
      manualCheckoutPlate
    );
    const ocrEnd = Date.now();
    const plateVerificationMs = ocrEnd - ocrStart;

    // 2. Parallel Cloudinary Upload with settled safety
    const uploadStart = Date.now();
    const uploadPromises = [
      uploadBufferToCloudinary(files.frontCheckOutFile.buffer),
      uploadBufferToCloudinary(files.rearCheckOutFile.buffer),
      uploadBufferToCloudinary(files.driverCheckOutFile.buffer),
    ];

    const uploadResults = await Promise.allSettled(uploadPromises);

    const uploadedImages: { publicId: string }[] = [];
    let uploadError: any = null;

    const settledUploads = uploadResults.map((res) => {
      if (res.status === 'fulfilled') {
        uploadedImages.push({ publicId: res.value.publicId });
        return res.value;
      } else {
        uploadError = res.reason;
        return null;
      }
    });

    if (uploadError) {
      if (uploadedImages.length > 0) {
        await Promise.allSettled(
          uploadedImages.map(img => deleteFromCloudinary(img.publicId))
        );
      }
      throw new AppError(500, `Lỗi tải lên hình ảnh minh chứng: ${uploadError?.message || uploadError}`);
    }

    const [frontUpload, rearUpload, driverUpload] = settledUploads as any[];
    const uploadEnd = Date.now();
    const evidenceUploadMs = uploadEnd - uploadStart;

    // 3. Persist verification record
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const checkoutVerification = await prisma.checkoutVerification.create({
      data: {
        checkInRecordId,
        normalizedPlate: verificationResult.verifiedPlate,
        vehicleType: record.vehicle.type,
        verificationMethod: verificationResult.method,
        frontCheckOutImageUrl: frontUpload.secureUrl,
        frontCheckOutImagePublicId: frontUpload.publicId,
        rearCheckOutImageUrl: rearUpload.secureUrl,
        rearCheckOutImagePublicId: rearUpload.publicId,
        driverCheckOutImageUrl: driverUpload.secureUrl,
        driverCheckOutImagePublicId: driverUpload.publicId,
        expiresAt,
      },
    });

    const totalMs = Date.now() - startTime;

    console.log(`[CheckoutVerification] plateVerificationMs=${plateVerificationMs}`);
    console.log(`[CheckoutVerification] evidenceUploadMs=${evidenceUploadMs}`);
    console.log(`[CheckoutVerification] totalMs=${totalMs}`);

    return {
      verificationId: checkoutVerification.id,
      expiresAt: expiresAt.toISOString(),
      verifiedPlate: verificationResult.verifiedPlate,
      verificationMethod: verificationResult.method,
    };
  },

  // ── POST /api/checkout/:checkInRecordId/stripe-session ───────────────────────────
  async createStripeSession(
    checkInRecordId: string,
    staffId: string,
    files?: {
      frontCheckOutFile?: Express.Multer.File;
      rearCheckOutFile?: Express.Multer.File;
      driverCheckOutFile?: Express.Multer.File;
    },
    manualCheckoutPlate?: string,
    verificationId?: string
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    if (!verificationId) {
      if (!files?.frontCheckOutFile) {
        throw new AppError(400, 'Vui lòng chụp ảnh phía trước xe lúc ra.');
      }
      if (!files?.rearCheckOutFile) {
        throw new AppError(400, 'Vui lòng chụp ảnh phía sau xe lúc ra.');
      }
      if (!files?.driverCheckOutFile) {
        throw new AppError(400, 'Vui lòng chụp ảnh người nhận xe.');
      }
    }

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

    let frontUrl: string | undefined;
    let frontPublicId: string | undefined;
    let rearUrl: string | undefined;
    let rearPublicId: string | undefined;
    let driverUrl: string | undefined;
    let driverPublicId: string | undefined;
    let verificationMethod: string = 'OCR';

    if (verificationId) {
      const verification = await validateVerification(verificationId, record);
      frontUrl = verification.frontCheckOutImageUrl;
      frontPublicId = verification.frontCheckOutImagePublicId;
      rearUrl = verification.rearCheckOutImageUrl;
      rearPublicId = verification.rearCheckOutImagePublicId;
      driverUrl = verification.driverCheckOutImageUrl;
      driverPublicId = verification.driverCheckOutImagePublicId;
      verificationMethod = verification.verificationMethod;
    } else {
      // ── Rear License Plate OCR / Controlled Manual Verification (Hard Security Gate) ──
      const vehicleType = (record.vehicle?.type === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR') as 'CAR' | 'MOTORBIKE';
      const { method: vMethod } = await verifyExitVehiclePlate(
        files!.rearCheckOutFile!.buffer,
        vehicleType,
        record.vehicle.plateNumber,
        manualCheckoutPlate
      );
      verificationMethod = vMethod;

      // ── Upload Checkout Images to Cloudinary ──
      try {
        const frontUpload = await uploadBufferToCloudinary(files!.frontCheckOutFile!.buffer);
        frontUrl = frontUpload.secureUrl;
        frontPublicId = frontUpload.publicId;

        const rearUpload = await uploadBufferToCloudinary(files!.rearCheckOutFile!.buffer);
        rearUrl = rearUpload.secureUrl;
        rearPublicId = rearUpload.publicId;

        const driverUpload = await uploadBufferToCloudinary(files!.driverCheckOutFile!.buffer);
        driverUrl = driverUpload.secureUrl;
        driverPublicId = driverUpload.publicId;
      } catch (uploadError) {
        if (frontPublicId) await deleteFromCloudinary(frontPublicId).catch(() => {});
        if (rearPublicId) await deleteFromCloudinary(rearPublicId).catch(() => {});
        if (driverPublicId) await deleteFromCloudinary(driverPublicId).catch(() => {});
        throw uploadError;
      }
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
      if (!verificationId) {
        if (frontPublicId) await deleteFromCloudinary(frontPublicId).catch(() => {});
        if (rearPublicId) await deleteFromCloudinary(rearPublicId).catch(() => {});
        if (driverPublicId) await deleteFromCloudinary(driverPublicId).catch(() => {});
      }
      throw new AppError(400, 'Số tiền thanh toán phải lớn hơn 0.');
    }

    let payment: any;
    let session: any;

    try {
      // Check for existing pending CARD payments for this CheckInRecord atomically
      payment = await prisma.$transaction(async (tx) => {
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

      const stripeStart = Date.now();
      session = await stripe.checkout.sessions.create({
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
          plateVerificationMethod: verificationMethod,
          frontCheckOutImageUrl: frontUrl ?? '',
          frontCheckOutImagePublicId: frontPublicId ?? '',
          rearCheckOutImageUrl: rearUrl ?? '',
          rearCheckOutImagePublicId: rearPublicId ?? '',
          driverCheckOutImageUrl: driverUrl ?? '',
          driverCheckOutImagePublicId: driverPublicId ?? '',
        },
      });
      const stripeEnd = Date.now();
      console.log(`[CheckoutStripe] sessionCreationMs=${stripeEnd - stripeStart}`);

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          transactionCode: session.id,
        },
      });
    } catch (stripeError) {
      if (!verificationId) {
        if (frontPublicId) await deleteFromCloudinary(frontPublicId).catch(() => {});
        if (rearPublicId) await deleteFromCloudinary(rearPublicId).catch(() => {});
        if (driverPublicId) await deleteFromCloudinary(driverPublicId).catch(() => {});
      }
      throw stripeError;
    }

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

      const config = await feeRuleService.getFeeConfig();
      const { total: grossParkingFee } = calcFee(
        new Date(record.checkInTime),
        record.checkOutTime,
        record.vehicle.type as 'CAR' | 'MOTORBIKE',
        config
      );

      const totalPaidDb = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          checkInRecordId: record.id,
          type: 'PARKING_FEE',
          status: 'SUCCESS',
        },
      });
      const totalSuccessfullyPaid = Number(totalPaidDb._sum.amount ?? 0);
      const amountDue = Math.max(0, grossParkingFee - bookingDepositPaid - totalSuccessfullyPaid);

      const receipt: CheckoutSubmitResult = {
        ok: true,
        plate: record.vehicle.plateNumber,
        slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
        fee: paymentAmount,
        isMonthly: record.isMonthly,
        checkOutTime: record.checkOutTime.toISOString(),
        grossParkingFee,
        bookingDepositPaid,
        totalSuccessfullyPaid,
        amountDue,
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

      const config = await feeRuleService.getFeeConfig();
      const { total: grossParkingFee } = calcFee(
        new Date(record.checkInTime),
        record.checkOutTime,
        record.vehicle.type as 'CAR' | 'MOTORBIKE',
        config
      );

      const totalPaidDb = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          checkInRecordId: record.id,
          type: 'PARKING_FEE',
          status: 'SUCCESS',
        },
      });
      const totalSuccessfullyPaid = Number(totalPaidDb._sum.amount ?? 0);
      const amountDue = Math.max(0, grossParkingFee - bookingDepositPaid - totalSuccessfullyPaid);

      const receipt: CheckoutSubmitResult = {
        ok: true,
        plate: record.vehicle.plateNumber,
        slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
        fee: parseFloat(String(payment.amount)),
        isMonthly: record.isMonthly,
        checkOutTime: record.checkOutTime.toISOString(),
        grossParkingFee,
        bookingDepositPaid,
        totalSuccessfullyPaid,
        amountDue,
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

          const isPrepayment = metadata.isPrepayment === 'true';

          if (payment.status === 'SUCCESS' && (isPrepayment || (record.checkOutTime !== null && record.status === 'COMPLETED'))) {
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

          if (isPrepayment) {
            await tx.checkInRecord.update({
              where: { id: record.id },
              data: {
                prepaidAt: now,
              },
            });
            return { success: true, alreadyProcessed: false };
          }

          if (!metadata.frontCheckOutImageUrl || !metadata.rearCheckOutImageUrl || !metadata.driverCheckOutImageUrl) {
            throw new AppError(400, 'Thiếu dữ liệu ảnh xác minh xe lúc ra được liên kết với phiên thanh toán Stripe.');
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
              frontCheckOutImageUrl: metadata.frontCheckOutImageUrl || null,
              frontCheckOutImagePublicId: metadata.frontCheckOutImagePublicId || null,
              rearCheckOutImageUrl: metadata.rearCheckOutImageUrl || null,
              rearCheckOutImagePublicId: metadata.rearCheckOutImagePublicId || null,
              driverCheckOutImageUrl: metadata.driverCheckOutImageUrl || null,
              driverCheckOutImagePublicId: metadata.driverCheckOutImagePublicId || null,
            },
          });

          await tx.guestAccessCredential.updateMany({
            where: {
              checkInRecordId: record.id,
              active: true,
            },
            data: {
              active: false,
              revokedAt: now,
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

  async lookupMonthlyQr(qrToken: string): Promise<CheckoutLookupResult> {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new AppError(400, 'Mã QR không hợp lệ.');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(qrToken, appConfig.jwtSecret, {
        issuer: 'smart-parking-backend',
        audience: 'smart-parking-checkout',
        algorithms: ['HS256'],
      });
    } catch (err) {
      throw new AppError(400, 'Mã QR gói tháng không hợp lệ hoặc không còn hiệu lực. Vui lòng thử lại hoặc nhập mã PIN.');
    }

    if (!decoded || decoded.purpose !== 'MONTHLY_CHECKOUT_QR' || !decoded.packageId || !decoded.vehicleId) {
      throw new AppError(400, 'Mã QR gói tháng không hợp lệ hoặc không còn hiệu lực. Vui lòng thử lại hoặc nhập mã PIN.');
    }

    const { packageId, vehicleId } = decoded;
    const now = new Date();

    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { vehicle: true },
    });

    if (!pkg) {
      throw new AppError(404, 'Không tìm thấy thông tin gói tháng của mã QR.');
    }

    if (pkg.status !== 'ACTIVE' || pkg.expiryDate.getTime() <= now.getTime() || pkg.startDate.getTime() > now.getTime()) {
      throw new AppError(400, 'Gói tháng không còn hiệu lực hoặc đã bị khóa.');
    }

    if (pkg.vehicleId !== vehicleId || !pkg.vehicle) {
      throw new AppError(400, 'Thông tin xe của gói tháng không trùng khớp.');
    }

    const activeRecords = await prisma.checkInRecord.findMany({
      where: {
        vehicleId: pkg.vehicleId,
        checkOutTime: null,
        status: 'PARKING',
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
        payments: true,
        guestCredential: true,
      },
    });

    if (activeRecords.length === 0) {
      throw new AppError(404, 'Không tìm thấy phiên gửi xe đang hoạt động cho xe này.');
    }

    if (activeRecords.length > 1) {
      throw new AppError(409, 'Phát hiện nhiều lượt gửi xe đang hoạt động trùng lặp cho xe này.');
    }

    const activeRecord = activeRecords[0];

    return mapRecordToLookupResult(activeRecord, now, true);
  },
};
