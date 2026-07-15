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
function normalizePlate(p: string): string {
  return p.replace(/[-.\s]/g, '').toUpperCase();
}

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
    const { total, breakdown } = calcFee(
      checkIn,
      now,
      vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );

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
      slotCode: record.slot?.code ?? '',
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
      slotCode: r.slot?.code ?? '',
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
      slotCode: record.slot?.code ?? '',
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

      await tx.parkingSlot.update({
        where: { id: record.slotId },
        data: {
          status: 'AVAILABLE',
          assignedVehicleId: record.isMonthly ? undefined : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: staffId,
          actorName: staff?.fullName ?? staffId,
          actorRole: staff?.roleRef?.name ?? 'STAFF',
          action: 'checkout.lost_ticket',
          targetType: 'CheckInRecord',
          targetId: record.id,
          description: `Xử lý mất thẻ xe ${plate} tại ô ${record.slot?.code ?? ''}`,
          metadata: JSON.stringify({
            plate,
            slotCode: record.slot?.code ?? '',
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
      slotCode: record.slot?.code ?? '',
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
    const { total, breakdown } = calcFee(
      new Date(record.checkInTime),
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );
    return {
      ticketId: record.id,
      plate: record.vehicle.plateNumber,
      slotCode: record.slot?.code ?? '',
      checkInTime: record.checkInTime.toISOString(),
      checkOutTime: now.toISOString(),
      durationMinutes: Math.round((now.getTime() - new Date(record.checkInTime).getTime()) / 60000),
      fee: total,
      isMonthly: record.isMonthly,
      breakdown,
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
    const { total, breakdown } = calcFee(
      new Date(record.checkInTime),
      now,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );
    let finalFee = total;
    if (record.isMonthly) finalFee = 0;

    await prisma.$transaction(async (tx) => {
      await tx.checkInRecord.update({
        where: { id: record.id },
        data: { checkOutTime: now },
      });

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

      await tx.parkingSlot.update({
        where: { id: record.slotId },
        data: {
          status: 'AVAILABLE',
          assignedVehicleId: record.isMonthly ? undefined : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.staffId,
          actorName: undefined,
          actorRole: 'STAFF',
          action: 'checkout.complete',
          targetType: 'CheckInRecord',
          targetId: record.id,
          description: `Check-out xe ${record.vehicle.plateNumber} tại ô ${record.slot?.code ?? ''}`,
          metadata: JSON.stringify({
            plate: record.vehicle.plateNumber,
            slotCode: record.slot?.code ?? '',
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
      slotCode: record.slot?.code ?? '',
      fee: finalFee,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
      breakdown,
    };
  },
};
