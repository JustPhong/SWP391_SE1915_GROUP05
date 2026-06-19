import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/helpers';
import { slotSuggestionService } from './slotSuggestion.service';
import { calcFee, FeeConfig } from '../utils/fee';
import { feeRuleService } from './feeRule.service';

const SLOT_AVAILABLE = 'AVAILABLE';
const SLOT_OCCUPIED = 'OCCUPIED';
const BOOKING_FULFILLED = 'FULFILLED';

async function findCreditableDeposit(vehicleId: string) {
  return prisma.booking.findFirst({
    where: { vehicleId, status: BOOKING_FULFILLED, depositStatus: 'PAID' },
    orderBy: { bookingTime: 'desc' },
  });
}

export interface CheckInInput {
  plateNumber: string;
  vehicleType?: 'MOTORBIKE' | 'CAR';
  slotId?: string;
  staffId: string;
}

export interface CheckOutInput {
  checkInRecordId: string;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
}

function buildFeeResult(checkIn: Date, checkOut: Date, vehicleType: 'CAR' | 'MOTORBIKE', config: FeeConfig) {
  const { total, breakdown } = calcFee(checkIn, checkOut, vehicleType, config);
  return { total, breakdown };
}

export const checkInService = {
  async checkIn(input: CheckInInput) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: input.plateNumber },
      include: { monthlyPackage: true },
    });

    if (!vehicle) {
      throw new AppError(400, 'Xe chưa đăng ký trong hệ thống');
    }

    const pkg = vehicle.monthlyPackage;
    const isMonthly = !!(pkg && pkg.status === 'ACTIVE');

    const activeVehicle = vehicle;

    const existing = await prisma.checkInRecord.findFirst({
      where: { vehicleId: activeVehicle.id, checkOutTime: null },
    });
    if (existing) {
      throw new AppError(400, 'Vehicle already has an active parking session');
    }

    let targetSlotId: string;
    const zone: 'MONTHLY' | 'CASUAL' = isMonthly ? 'MONTHLY' : 'CASUAL';

    if (isMonthly && pkg?.slotId) {
      targetSlotId = pkg.slotId;
    } else if (input.slotId) {
      const manualSlot = await prisma.parkingSlot.findUnique({
        where: { id: input.slotId },
        include: { floor: true },
      });
      if (!manualSlot) throw new AppError(404, 'Slot not found');
      if (manualSlot.floor.customerType !== zone) {
        throw new AppError(400, 'Slot không thuộc khu vực phù hợp với loại khách (gói tháng/khách lẻ)');
      }
      targetSlotId = input.slotId;
    } else {
      const slot = await slotSuggestionService.suggestSlot(vehicle.type, zone);
      if (!slot) throw new AppError(404, 'No available slot found');
      targetSlotId = slot.id;
    }

    const slot = await prisma.parkingSlot.findUnique({ where: { id: targetSlotId } });
    if (!slot) throw new AppError(404, 'Slot not found');
    if (slot.status !== SLOT_AVAILABLE) {
      throw new AppError(409, 'Selected slot is not available');
    }
    if (slot.type !== activeVehicle.type && activeVehicle.type === 'MOTORBIKE') {
    } else if (slot.type !== activeVehicle.type) {
      throw new AppError(400, 'Slot type does not match vehicle type');
    }

    await prisma.$transaction([
      prisma.parkingSlot.update({
        where: { id: targetSlotId },
        data: { status: SLOT_OCCUPIED },
      }),
      prisma.checkInRecord.create({
        data: {
          vehicleId: activeVehicle.id,
          slotId: targetSlotId,
          isMonthly,
        },
      }),
    ]);

    const record = await prisma.checkInRecord.findFirst({
      where: { vehicleId: activeVehicle.id },
      orderBy: { createdAt: 'desc' },
      include: { slot: true, vehicle: { include: { owner: true } } },
    });
    return record;
  },

  async getActiveRecords() {
    return prisma.checkInRecord.findMany({
      where: { checkOutTime: null },
      orderBy: { checkInTime: 'desc' },
      include: {
        slot: true,
        vehicle: { include: { owner: true } },
      },
    });
  },
};

export const checkOutService = {
  async previewFee(recordId: string) {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: recordId },
      include: { slot: true, vehicle: true },
    });
    if (!record) throw new AppError(404, 'Check-in record not found');
    if (record.checkOutTime) throw new AppError(400, 'Vehicle already checked out');

    const checkIn = new Date(record.checkInTime);
    const checkOut = new Date();
    const config = await feeRuleService.getFeeConfig();
    const { total, breakdown } = buildFeeResult(checkIn, checkOut, record.vehicle.type as 'CAR' | 'MOTORBIKE', config);

    const creditable = await findCreditableDeposit(record.vehicleId);
    const depositCredit = creditable ? Number(creditable.depositAmount) : 0;
    const finalFee = Math.max(0, total - depositCredit);

    return {
      recordId: record.id,
      plate: record.vehicle.plateNumber,
      slotCode: record.slot.code,
      vehicleType: record.vehicle.type as 'CAR' | 'MOTORBIKE',
      isMonthly: record.isMonthly,
      checkInTime: record.checkInTime.toISOString(),
      now: checkOut.toISOString(),
      durationMinutes: Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000),
      fee: total,
      breakdown,
      depositCredit,
      amountDue: finalFee,
    };
  },

  async checkOut(input: CheckOutInput) {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: input.checkInRecordId },
      include: { slot: true, vehicle: true },
    });
    if (!record) throw new AppError(404, 'Check-in record not found');
    if (record.checkOutTime) throw new AppError(400, 'Vehicle already checked out');

    if (record.isMonthly) {
      await prisma.$transaction([
        prisma.parkingSlot.update({
          where: { id: record.slotId },
          data: { status: SLOT_AVAILABLE },
        }),
        prisma.checkInRecord.update({
          where: { id: record.id },
          data: { checkOutTime: new Date() },
        }),
      ]);
      return {
        recordId: record.id,
        paymentRequired: false,
        amountDue: 0,
        note: 'Đã bao gồm trong gói tháng',
      };
    }

    const checkIn = new Date(record.checkInTime);
    const checkOut = new Date();
    const config = await feeRuleService.getFeeConfig();
    const { total: amount, breakdown } = calcFee(
      checkIn,
      checkOut,
      record.vehicle.type as 'CAR' | 'MOTORBIKE',
      config,
    );

    const creditable = await findCreditableDeposit(record.vehicleId);
    const depositCredit = creditable ? Number(creditable.depositAmount) : 0;
    const finalAmount = Math.max(0, amount - depositCredit);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.parkingSlot.update({
        where: { id: record.slotId },
        data: { status: SLOT_AVAILABLE },
      }),
      prisma.checkInRecord.update({
        where: { id: record.id },
        data: { checkOutTime: new Date() },
      }),
      prisma.payment.create({
        data: {
          checkInRecordId: record.id,
          amount: finalAmount,
          method: input.paymentMethod,
          type: 'SESSION',
        },
      }),
    ];
    if (creditable) {
      ops.push(
        prisma.booking.update({
          where: { id: creditable.id },
          data: { depositStatus: 'REFUNDED' },
        })
      );
    }
    await prisma.$transaction(ops);

    return {
      recordId: record.id,
      paymentRequired: true,
      amountDue: finalAmount,
      grossFee: amount,
      depositCredit,
      fee: finalAmount,
      breakdown,
      durationHours: Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 10) / 10,
    };
  },
};
