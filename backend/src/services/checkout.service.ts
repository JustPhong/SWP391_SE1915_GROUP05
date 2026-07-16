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
  breakdown?: Array<{
    label: string;
    minutesInBlock: number;
    lots: number;
    rate: number;
    amount: number;
    note?: string;
  }>;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  packageExpiry?: string;
  // ── Booking deposit info ──
  depositAmount?: number;
  hasBookingDeposit?: boolean;
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
  breakdown?: Array<{
    label: string;
    minutesInBlock: number;
    lots: number;
    rate: number;
    amount: number;
    note?: string;
  }>;
  // ── Booking deposit info ──
  depositDeducted?: number;
}

// ── Service ──────────────────────────────────────────────
function normalizePlate(p: string): string {
  return p.replace(/[-.\s]/g, '').toUpperCase();
}

/** Kiểm tra xe có booking cọc không (chỉ cho vãng lai) */
async function getBookingDeposit(vehicleId: string): Promise<{ depositAmount: number; bookingId: string } | null> {
  const booking = await prisma.booking.findFirst({
    where: {
      vehicleId,
      status: 'FULFILLED',
      depositAmount: { gt: 0 },
      depositStatus: 'PAID',
    },
    select: { id: true, depositAmount: true },
    orderBy: { bookingTime: 'desc' },
  });
  if (!booking) return null;
  return { depositAmount: Number(booking.depositAmount), bookingId: booking.id };
}

const BOOKING_DEPOSIT = 15000;

export const checkoutService = {
  // ── GET /api/checkout/lookup/:plate ───────────────────────
  async lookupPlate(plate: string): Promise<CheckoutLookupResult> {
    const cleaned = plate.trim().toUpperCase();
    const stripped = normalizePlate(plate);
    const vehicles = await prisma.vehicle.findMany({
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

    const vehicle = vehicles.find((v) => normalizePlate(v.plateNumber) === stripped) ?? null;

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
    let { total, breakdown } = calcFee(
      checkIn,
      now,
      vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );

    // ── Kiểm tra booking cọc (BR-BK-02) ──
    let depositAmount = 0;
    let hasBookingDeposit = false;
    if (!record.isMonthly) {
      const deposit = await getBookingDeposit(vehicle.id);
      if (deposit) {
        depositAmount = Number(deposit.depositAmount);
        hasBookingDeposit = true;
        total = Math.max(0, total - depositAmount); // Trừ cọc vào phí
      }
    }

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
      breakdown: breakdown ? [
        ...breakdown.map(b => ({
          label: b.label,
          minutesInBlock: b.minutesInBlock,
          lots: b.lots,
          rate: b.rate,
          amount: b.amount,
          note: b.note,
        })),
        ...(hasBookingDeposit ? [{
          label: 'Trừ cọc đặt chỗ (15k)',
          minutesInBlock: 0,
          lots: 0,
          rate: 0,
          amount: -depositAmount,
          note: 'BR-BK-02',
        }] : []),
      ] : undefined,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,
      year: vehicle.year,
      seats: vehicle.seats,
      ownerName: vehicle.owner?.fullName ?? null,
      ownerPhone: vehicle.owner?.phoneNumber ?? null,
      ownerEmail: vehicle.owner?.email ?? null,
      packageExpiry,
      depositAmount,
      hasBookingDeposit,
    };
  },

  // ── GET /api/checkout/parked ─────────────────────────────
  async getParkedVehicles(): Promise<(ParkedVehicle & { recordId: string })[]> {
    const records = await prisma.checkInRecord.findMany({
      where: { checkOutTime: null },
      include: {
        vehicle: true,
        slot: true,
      },
      orderBy: { checkInTime: 'asc' },
    });

    return records.map((r) => ({
      recordId: r.id,
      plate: r.vehicle.plateNumber,
      vehicleType: r.vehicle.type as 'CAR' | 'MOTORBIKE',
      slotCode: r.slot?.code ?? (r.allowedTier ? `Khu ${r.allowedTier === 'VIP' ? 'VIP' : r.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      checkInTime: r.checkInTime.toISOString(),
      isMonthly: r.isMonthly,
    }));
  },

  // ── POST /api/checkout ───────────────────────────────────
  async submit(params: {
    plate: string;
    method?: 'CASH' | 'CARD' | 'EWALLET';
  }): Promise<CheckoutSubmitResult> {
    const { plate, method = 'CASH' } = params;

    const stripped = normalizePlate(plate);
    const vehicles = await prisma.vehicle.findMany({});
    const vehicle = vehicles.find((v) => normalizePlate(v.plateNumber) === stripped) ?? null;

    if (!vehicle) {
      throw new AppError(404, 'Xe không có trong bãi đỗ.');
    }

    const record = await prisma.checkInRecord.findFirst({
      where: { vehicleId: vehicle.id, checkOutTime: null },
      include: { slot: true },
    });

    if (!record) {
      throw new AppError(404, 'Xe không có trong bãi đỗ.');
    }

    const now = new Date();
    const checkIn = new Date(record.checkInTime);
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = calcFee(
      checkIn,
      now,
      vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );

    await prisma.$transaction(async (tx) => {
      await tx.checkInRecord.update({
        where: { id: record.id },
        data: { checkOutTime: now },
      });

      if (!record.isMonthly && total > 0) {
        await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            amount: total,
            method,
            type: 'SESSION',
            paidAt: now,
          },
        });
      }

      if (record.slotId) {
        const updateData: { status: string; assignedVehicleId?: string | null } = {
          status: 'AVAILABLE',
        };
        if (!record.isMonthly) {
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
      plate: vehicle.plateNumber,
      slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      fee: total,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
    };
  },

  async submitLostTicket(params: {
    plate: string;
    method?: 'CASH' | 'CARD' | 'EWALLET';
    staffId: string;
  }): Promise<CheckoutSubmitResult & { penaltyFee: number }> {
    const { plate, method = 'CASH', staffId } = params;

    const stripped = normalizePlate(plate);
    const [vehicle, staff] = await Promise.all([
      (async () => {
        const all = await prisma.vehicle.findMany({});
        return all.find((v) => normalizePlate(v.plateNumber) === stripped) ?? null;
      })(),
      prisma.user.findUnique({
        where: { id: staffId },
        select: { fullName: true, roleRef: { select: { name: true } } },
      }),
    ]);

    if (!vehicle) throw new AppError(404, 'Xe không có trong bãi đỗ.');

    const record = await prisma.checkInRecord.findFirst({
      where: { vehicleId: vehicle.id, checkOutTime: null },
      include: { slot: true },
    });

    if (!record) throw new AppError(404, 'Xe không có trong bãi đỗ.');

    const now = new Date();
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = calcFee(
      new Date(record.checkInTime),
      now,
      vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );

    const vehicleType = vehicle.type as 'CAR' | 'MOTORBIKE';
    const penaltyFee = LOST_TICKET_PENALTY[vehicleType];
    const finalFee = total + penaltyFee;

    await prisma.$transaction(async (tx) => {
      await tx.checkInRecord.update({
        where: { id: record.id },
        data: { checkOutTime: now, isLostTicket: true },
      });

      if (!record.isMonthly) {
        await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            amount: finalFee,
            method,
            type: 'SESSION',
            paidAt: now,
            collectedById: staffId,
          },
        });
      }

      if (record.slotId) {
        await tx.parkingSlot.update({
          where: { id: record.slotId },
          data: {
            status: 'AVAILABLE',
            assignedVehicleId: record.isMonthly ? undefined : null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          actorName: staff?.fullName ?? staffId,
          actorRole: staff?.roleRef?.name ?? 'STAFF',
          action: 'checkout.lost_ticket',
          targetType: 'CheckInRecord',
          targetId: record.id,
          description: `Xử lý mất thẻ xe ${plate} tại ô ${record.slot?.code ?? 'Không cố định'} — phí phạt ${penaltyFee.toLocaleString('vi-VN')}đ`,
          metadata: JSON.stringify({
            plate,
            slotCode: record.slot?.code ?? null,
            parkingFee: total,
            penaltyFee,
            totalFee: finalFee,
            method,
            checkInTime: record.checkInTime,
            checkOutTime: now,
          }),
        },
      });
    });

    return {
      ok: true,
      plate: vehicle.plateNumber,
      slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      fee: finalFee,
      penaltyFee,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
    };
  },

  async uploadPhotos(ticketId: string, photos: { front: string; back: string }) {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: ticketId },
      include: { slot: true, vehicle: true },
    });
    if (!record) throw new AppError(404, 'Không tìm thấy vé/xe.');
    // Giả lập lưu ảnh bằng metadata JSON trên CheckInRecord
    const updated = await prisma.checkInRecord.update({
      where: { id: ticketId },
      data: {
        // Nếu muốn persist, thêm field photos vào schema; hiện tại không mutate DB
      },
    });
    return { ok: true, ticketId, photos };
  },

  async calculateFee(ticketId: string, checkOutTime?: string) {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: ticketId },
      include: { vehicle: true, slot: true },
    });
    if (!record) throw new AppError(404, 'Không tìm thấy vé.');
    const now = checkOutTime ? new Date(checkOutTime) : new Date();
    const config = await feeRuleService.getFeeConfig();
    let { total, breakdown } = calcFee(
      new Date(record.checkInTime),
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );

    // ── Kiểm tra booking cọc (BR-BK-02) ──
    let depositDeducted = 0;
    if (!record.isMonthly) {
      const deposit = await getBookingDeposit(record.vehicleId);
      if (deposit) {
        depositDeducted = Number(deposit.depositAmount);
        total = Math.max(0, total - depositDeducted);
      }
    }

    return {
      ticketId: record.id,
      plate: record.vehicle.plateNumber,
      slotCode: record.slot?.code ?? null,
      checkInTime: record.checkInTime.toISOString(),
      checkOutTime: now.toISOString(),
      durationMinutes: Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60000),
      fee: total,
      isMonthly: record.isMonthly,
      breakdown,
      depositDeducted,
    };
  },

  async complete(ticketId: string, params: { method?: 'CASH' | 'CARD' | 'EWALLET'; photos?: { front: string; back: string }; staffId: string }) {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: ticketId },
      include: { slot: true, vehicle: true },
    });
    if (!record) throw new AppError(404, 'Không tìm thấy vé.');
    const now = new Date();
    const config = await feeRuleService.getFeeConfig();
    let { total, breakdown } = calcFee(
      new Date(record.checkInTime),
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );
    let finalFee = total;
    if (record.isMonthly) finalFee = 0;

    // ── Trừ cọc booking (BR-BK-02) ──
    let depositDeducted = 0;
    if (!record.isMonthly && finalFee > 0) {
      const deposit = await getBookingDeposit(record.vehicleId);
      if (deposit) {
        depositDeducted = Number(deposit.depositAmount);
        finalFee = Math.max(0, finalFee - depositDeducted);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.checkInRecord.update({
        where: { id: record.id },
        data: { checkOutTime: now },
      });

      // Chỉ tạo payment nếu còn phải trả sau khi trừ cọc
      if (!record.isMonthly && finalFee > 0) {
        await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            amount: finalFee,
            method: params.method ?? 'CASH',
            type: 'SESSION',
            paidAt: now,
            collectedById: params.staffId,
          },
        });
      }

      if (record.slotId) {
        await tx.parkingSlot.update({
          where: { id: record.slotId },
          data: {
            status: 'AVAILABLE',
            assignedVehicleId: record.isMonthly ? undefined : null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: params.staffId,
          actorName: undefined,
          actorRole: 'STAFF',
          action: 'checkout.complete',
          targetType: 'CheckInRecord',
          targetId: record.id,
          description: `Check-out xe ${record.vehicle.plateNumber} tại ô ${record.slot?.code ?? 'Không cố định'}`,
          metadata: JSON.stringify({
            plate: record.vehicle.plateNumber,
            slotCode: record.slot?.code ?? null,
            method: params.method,
            photos: params.photos,
            fee: finalFee,
            isMonthly: record.isMonthly,
            checkInTime: record.checkInTime,
            checkOutTime: now,
          }),
        },
      });
    });

    return {
      ok: true,
      plate: record.vehicle.plateNumber,
      slotCode: record.slot?.code ?? null,
      fee: finalFee,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
      depositDeducted,
    };
  },
};