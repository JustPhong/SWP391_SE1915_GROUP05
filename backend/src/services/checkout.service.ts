import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { calcFee } from '../utils/fee';
import { feeRuleService } from './feeRule.service';
// ── Lookup result shapes ──────────────────────────────────
const LOST_TICKET_PENALTY = 50000;
export interface CheckoutLookupResult {
  found: boolean;
  // ── only when found === true ──
  recordId?: string;
  plate?: string;
  vehicleType?: 'CAR' | 'MOTORBIKE';
  slotCode?: string;
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
}

export interface ParkedVehicle {
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  slotCode: string;
  checkInTime: string;
  isMonthly: boolean;
}

export interface CheckoutSubmitResult {
  ok: boolean;
  plate: string;
  slotCode: string;
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
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: plate },
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

    return {
      found: true,
      recordId: record.id,
      plate: vehicle.plateNumber,
      vehicleType: vehicle.type as 'CAR' | 'MOTORBIKE',
      slotCode: record.slot.code,
      isMonthly: record.isMonthly,
      checkInTime: record.checkInTime.toISOString(),
      now: now.toISOString(),
      durationMinutes,
      fee: total,
      breakdown,
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
      slotCode: r.slot.code,
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

    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: plate },
    });

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
    });

    return {
      ok: true,
      plate: vehicle.plateNumber,
      slotCode: record.slot.code,
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

  const [vehicle, staff] = await Promise.all([
    prisma.vehicle.findUnique({ where: { plateNumber: plate } }),
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

  const finalFee = total + LOST_TICKET_PENALTY;

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

    await tx.parkingSlot.update({
      where: { id: record.slotId },
      data: {
        status: 'AVAILABLE',
        assignedVehicleId: record.isMonthly ? undefined : null,
      },
    });

    // ── Ghi AuditLog sự cố mất thẻ ──────────────────────
    await tx.auditLog.create({
      data: {
        actorId:     staffId,
        actorName:   staff?.fullName ?? staffId,
        actorRole:   staff?.roleRef?.name ?? 'STAFF',
        action:      'checkout.lost_ticket',
        targetType:  'CheckInRecord',
        targetId:    record.id,
        description: `Xử lý mất thẻ xe ${plate} tại ô ${record.slot.code} — phí phạt ${LOST_TICKET_PENALTY.toLocaleString('vi-VN')}đ`,
        metadata:    JSON.stringify({
          plate,
          slotCode:    record.slot.code,
          parkingFee:  total,
          penaltyFee:  LOST_TICKET_PENALTY,
          totalFee:    finalFee,
          method,
          checkInTime: record.checkInTime,
          checkOutTime: now,
        }),
      },
    });
  });

  return {
    ok:           true,
    plate:        vehicle.plateNumber,
    slotCode:     record.slot.code,
    fee:          finalFee,
    penaltyFee:   LOST_TICKET_PENALTY,
    isMonthly:    record.isMonthly,
    checkOutTime: now.toISOString(),
    breakdown,
  };
},
};
