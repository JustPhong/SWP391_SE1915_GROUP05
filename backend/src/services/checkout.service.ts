import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { calcFee } from '../utils/fee';

// ── Lookup result shapes ──────────────────────────────────
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
        checkOutTime: null,   // open record only
      },
      include: { slot: true },
    });

    if (!record) {
      return { found: false };
    }

    const now = new Date();
    const checkIn = new Date(record.checkInTime);
    const durationMinutes = Math.round((now.getTime() - checkIn.getTime()) / 60_000);
    const { total, breakdown } = calcFee(
      checkIn,
      now,
      vehicle.type as 'CAR' | 'MOTORBIKE',
      record.isMonthly,
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

    // ── 1. Find the open record ──────────────────────────
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

    // ── 2. Recompute fee (never trust client) ────────────
    const now = new Date();
    const checkIn = new Date(record.checkInTime);
    const { total } = calcFee(
      checkIn,
      now,
      vehicle.type as 'CAR' | 'MOTORBIKE',
      record.isMonthly,
    );

    // ── 3. Prisma transaction ─────────────────────────────
    await prisma.$transaction(async (tx) => {
      // 3a. Close the record
      await tx.checkInRecord.update({
        where: { id: record.id },
        data: { checkOutTime: now },
      });

      // 3b. Create payment for casual (monthly = 0, skip)
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

      // 3c. Free the slot
      // Monthly fixed slot: keep it reserved for the owner (status stays AVAILABLE
      // but assignedVehicleId and isFixed remain; do NOT clear the slot link).
      // Casual slot: clear assignedVehicleId so it can be reassigned.
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
    };
  },
};
