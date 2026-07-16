import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { calcFee } from '../utils/fee';
import { feeRuleService } from './feeRule.service';
// ── Lookup result shapes ──────────────────────────────────
const LOST_TICKET_PENALTY: Record<'CAR' | 'MOTORBIKE', number> = {
  MOTORBIKE: 80000,
  CAR: 200000,
};
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
}

export interface ParkedVehicle {
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  slotCode: string | null;
  checkInTime: string;
  isMonthly: boolean;
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
}

// ── Service ──────────────────────────────────────────────
export const checkoutService = {
  // ── GET /api/checkout/lookup/:plate ───────────────────────
  async lookupPlate(plate: string): Promise<CheckoutLookupResult> {
    const cleaned = plate.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { plateNumber: cleaned },
          { plateNumber: stripped },
        ],
      },
      include: {
        owner: {
          select: {
            fullName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    if (!vehicle) {
      return { found: false };
    }

    const record = await prisma.checkInRecord.findFirst({
      where: {
        vehicleId: vehicle.id,
        checkOutTime: null,
      },
      include: { slot: true },
    });

    if (!record) {
      return { found: false };
    }

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
    if (!record.isMonthly) {
      const booking = await prisma.booking.findFirst({
        where: {
          vehicleId: vehicle.id,
          status: 'FULFILLED',
          depositStatus: 'PAID',
        },
      });
      if (booking) {
        depositCredit = parseFloat(String(booking.depositAmount)) || 0;
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
      fee: total,
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
    };
  },

  // ── GET /api/checkout/parked ─────────────────────────────
  async getParkedVehicles(): Promise<ParkedVehicle[]> {
    const records = await prisma.checkInRecord.findMany({
      where: { checkOutTime: null },
      include: {
        vehicle: true,
        slot: true,
      },
      orderBy: { checkInTime: 'asc' },
    });

    return records.map((r) => ({
      plate: r.vehicle.plateNumber,
      vehicleType: r.vehicle.type as 'CAR' | 'MOTORBIKE',
      slotCode: r.slot?.code ?? (r.allowedTier ? `Khu ${r.allowedTier === 'VIP' ? 'VIP' : r.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      checkInTime: r.checkInTime.toISOString(),
      isMonthly: r.isMonthly,
    }));
  },

  // ── GET /api/checkout/preview/:recordId ───────────────────
  async previewFee(recordId: string): Promise<{
    fee: number;
    breakdown: any[];
    depositCredit: number;
    amountDue: number;
    penaltyFee?: number;
  }> {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: recordId },
      include: { vehicle: true },
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
    if (!record.isMonthly) {
      const booking = await prisma.booking.findFirst({
        where: {
          vehicleId: record.vehicleId,
          status: 'FULFILLED',
          depositStatus: 'PAID',
        },
      });
      if (booking) {
        depositCredit = parseFloat(String(booking.depositAmount)) || 0;
      }
    }

    const amountDue = Math.max(0, total - depositCredit);

    return {
      fee: total,
      breakdown,
      depositCredit,
      amountDue,
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

    if (method !== 'CASH') {
      throw new AppError(400, 'Chỉ chấp nhận thanh toán bằng tiền mặt (CASH) tại quầy cổng.');
    }

    let record: any = null;

    if (checkInRecordId) {
      record = await prisma.checkInRecord.findUnique({
        where: { id: checkInRecordId },
        include: { vehicle: true, slot: true },
      });
    } else if (plate) {
      const cleaned = plate.trim().toUpperCase();
      const stripped = cleaned.replace(/[-.\s]/g, '');
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { plateNumber: cleaned },
            { plateNumber: stripped },
          ],
        },
      });
      if (vehicle) {
        record = await prisma.checkInRecord.findFirst({
          where: { vehicleId: vehicle.id, checkOutTime: null },
          include: { vehicle: true, slot: true },
        });
      }
    }

    if (!record || record.checkOutTime !== null) {
      throw new AppError(404, 'Không tìm thấy lượt đỗ xe đang hoạt động.');
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
    let bookingToUse: any = null;

    if (!record.isMonthly) {
      bookingToUse = await prisma.booking.findFirst({
        where: {
          vehicleId: record.vehicleId,
          status: 'FULFILLED',
          depositStatus: 'PAID',
        },
      });
      if (bookingToUse) {
        depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
      }
    }

    const finalAmountDue = Math.max(0, total - depositCredit);

    await prisma.$transaction(async (tx) => {
      // 1. Transaction gate: atomic update checkInRecord status
      const updated = await tx.checkInRecord.updateMany({
        where: {
          id: record.id,
          checkOutTime: null,
          status: 'PARKING',
        },
        data: {
          checkOutTime: now,
          checkedOutById: staffId,
          status: 'COMPLETED',
        },
      });

      if (updated.count === 0) {
        throw new AppError(409, 'Phiên gửi xe này đã được thanh toán hoặc đã kết thúc.');
      }

      // 2. Create Payment only if total > 0 (if guest monthly, no payment created)
      if (!record.isMonthly && finalAmountDue > 0) {
        await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            amount: finalAmountDue,
            method,
            type: 'SESSION',
            paidAt: now,
            collectedById: staffId,
          },
        });
      }

      // 3. Consume Booking Deposit if present
      if (bookingToUse) {
        await tx.booking.update({
          where: { id: bookingToUse.id },
          data: { depositStatus: 'USED' },
        });
      }

      // 4. Update Slot Status
      if (record.slotId) {
        const updateData: { status: string; assignedVehicleId?: string | null } = {
          status: 'AVAILABLE',
        };
        // Preserving assignedVehicleId for fixed monthly slots
        if (!record.isMonthly && !record.slot.isFixed) {
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
      fee: finalAmountDue,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
    };
  },

  // ── POST /api/checkout/lost-ticket ───────────────────────
  async submitLostTicket(params: {
    checkInRecordId?: string;
    plate?: string;
    method?: 'CASH' | 'CARD' | 'EWALLET';
    staffId: string;
    reason: string;
  }): Promise<CheckoutSubmitResult & { penaltyFee: number }> {
    const { checkInRecordId, plate, method = 'CASH', staffId, reason } = params;

    if (!reason || reason.trim().length < 5) {
      throw new AppError(400, 'Lý do sự cố mất thẻ phải tối thiểu 5 ký tự.');
    }

    if (method !== 'CASH') {
      throw new AppError(400, 'Chỉ chấp nhận thanh toán bằng tiền mặt (CASH) tại quầy cổng.');
    }

    let record: any = null;

    if (checkInRecordId) {
      record = await prisma.checkInRecord.findUnique({
        where: { id: checkInRecordId },
        include: { vehicle: true, slot: true },
      });
    } else if (plate) {
      const cleaned = plate.trim().toUpperCase();
      const stripped = cleaned.replace(/[-.\s]/g, '');
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { plateNumber: cleaned },
            { plateNumber: stripped },
          ],
        },
      });
      if (vehicle) {
        record = await prisma.checkInRecord.findFirst({
          where: { vehicleId: vehicle.id, checkOutTime: null },
          include: { vehicle: true, slot: true },
        });
      }
    }

    if (!record || record.checkOutTime !== null) {
      throw new AppError(404, 'Không tìm thấy lượt đỗ xe đang hoạt động.');
    }

    const now = new Date();
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = calcFee(
      new Date(record.checkInTime),
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config
    );

    const vehicleType = record.vehicle.type as 'CAR' | 'MOTORBIKE';
    const penaltyFee = LOST_TICKET_PENALTY[vehicleType];

    let depositCredit = 0;
    let bookingToUse: any = null;

    if (!record.isMonthly) {
      bookingToUse = await prisma.booking.findFirst({
        where: {
          vehicleId: record.vehicleId,
          status: 'FULFILLED',
          depositStatus: 'PAID',
        },
      });
      if (bookingToUse) {
        depositCredit = parseFloat(String(bookingToUse.depositAmount)) || 0;
      }
    }

    const finalFee = total + penaltyFee;
    const finalAmountDue = Math.max(0, finalFee - depositCredit);

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      select: { fullName: true, roleRef: { select: { name: true } } },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Transaction gate: atomic update checkInRecord status
      const updated = await tx.checkInRecord.updateMany({
        where: {
          id: record.id,
          checkOutTime: null,
          status: 'PARKING',
        },
        data: {
          checkOutTime: now,
          checkedOutById: staffId,
          status: 'COMPLETED',
          isLostTicket: true,
        },
      });

      if (updated.count === 0) {
        throw new AppError(409, 'Phiên gửi xe này đã được thanh toán hoặc đã kết thúc.');
      }

      // 2. Create Payment
      if (!record.isMonthly && finalAmountDue > 0) {
        await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            amount: finalAmountDue,
            method,
            type: 'SESSION',
            paidAt: now,
            collectedById: staffId,
          },
        });
      }

      // 3. Consume Booking Deposit if present
      if (bookingToUse) {
        await tx.booking.update({
          where: { id: bookingToUse.id },
          data: { depositStatus: 'USED' },
        });
      }

      // 4. Update Slot Status
      if (record.slotId) {
        const updateData: { status: string; assignedVehicleId?: string | null } = {
          status: 'AVAILABLE',
        };
        if (!record.isMonthly && !record.slot.isFixed) {
          updateData.assignedVehicleId = null;
        }
        await tx.parkingSlot.update({
          where: { id: record.slotId },
          data: updateData,
        });
      }

      // 5. Write audit log with reason
      await tx.auditLog.create({
        data: {
          actorId: staffId,
          actorName: staff?.fullName ?? staffId,
          actorRole: staff?.roleRef?.name ?? 'STAFF',
          action: 'checkout.lost_ticket',
          targetType: 'CheckInRecord',
          targetId: record.id,
          description: `Xử lý sự cố mất thẻ xe ${record.vehicle.plateNumber} tại ô ${record.slot?.code ?? 'Không cố định'} — Lý do: ${reason} — phí phạt ${penaltyFee.toLocaleString('vi-VN')}đ`,
          metadata: JSON.stringify({
            plate: record.vehicle.plateNumber,
            slotCode: record.slot?.code ?? null,
            parkingFee: total,
            penaltyFee,
            depositCredit,
            totalFee: finalFee,
            amountPaid: finalAmountDue,
            method,
            reason,
            checkInTime: record.checkInTime,
            checkOutTime: now,
          }),
        },
      });
    });

    return {
      ok: true,
      plate: record.vehicle.plateNumber,
      slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      fee: finalAmountDue,
      penaltyFee,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
    };
  },
};
