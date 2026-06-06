import prisma from '../config/db';
import { AppError } from '../utils/helpers';

// ── Pricing constants ────────────────────────────────────
const RATE_CAR = 15_000;       // VND / hour
const RATE_MOTORBIKE = 5_000;  // VND / hour

// ── Shared billing helper ─────────────────────────────────
// Reused by both lookup and checkout so fee computation is always consistent.
function computeFee(vehicleType: string, durationMinutes: number): { billedHours: number; ratePerHour: number; fee: number } {
  const billedHours = Math.max(1, Math.ceil(durationMinutes / 60));
  const ratePerHour = vehicleType === 'MOTORBIKE' ? RATE_MOTORBIKE : RATE_CAR;
  const fee = billedHours * ratePerHour;
  return { billedHours, ratePerHour, fee };
}

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
  billedHours?: number;
  ratePerHour?: number;
  fee?: number;
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
    const { billedHours, ratePerHour, fee } = computeFee(vehicle.type, durationMinutes);

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
      billedHours,
      ratePerHour,
      fee,
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
    const durationMinutes = Math.round((now.getTime() - checkIn.getTime()) / 60_000);
    const { fee } = computeFee(vehicle.type, durationMinutes);

    // ── 3. Prisma transaction ─────────────────────────────
    await prisma.$transaction(async (tx) => {
      // 3a. Close the record
      await tx.checkInRecord.update({
        where: { id: record.id },
        data: { checkOutTime: now },
      });

      // 3b. Create payment for casual (monthly = 0, skip)
      if (!record.isMonthly && fee > 0) {
        await tx.payment.create({
          data: {
            checkInRecordId: record.id,
            amount: fee,
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
      fee,
      isMonthly: record.isMonthly,
      checkOutTime: now.toISOString(),
    };
  },
};
