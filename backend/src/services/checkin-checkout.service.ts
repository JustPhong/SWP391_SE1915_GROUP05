import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/helpers';
import { acquireVehicleOrPlateLock, getVehicleOperationalState } from '../utils/vehicleState';
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
    const cleaned = input.plateNumber.trim().toUpperCase();
    const stripped = cleaned.replace(/[-.\s]/g, '');

    return await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: {
          OR: [
            { plateNumber: cleaned },
            { plateNumber: stripped },
          ],
        },
        include: { monthlyPackage: true },
      });

      if (!vehicle) {
        throw new AppError(400, 'Xe chưa đăng ký trong hệ thống');
      }

      // Concurrency Lock
      await acquireVehicleOrPlateLock(tx, vehicle.id, input.plateNumber);

      // Resolve operational state
      const state = await getVehicleOperationalState(tx, {
        vehicleId: vehicle.id,
        plateNumber: input.plateNumber
      });

      // Duplicate Check-in guard
      if (state.activeCheckIn) {
        throw new AppError(
          409,
          `Biển số ${input.plateNumber} hiện đang có lượt gửi xe trong bãi. Vui lòng check-out lượt hiện tại trước khi check-in lại.`,
          true,
          'ACTIVE_PARKING_SESSION'
        );
      }

      // Inconsistency check
      if (state.activeBooking && state.activeMonthlyPackage) {
        throw new AppError(409, 'Trạng thái xe không nhất quán. Vui lòng kiểm tra lượt đặt chỗ và gói tháng.');
      }

      const pkg = vehicle.monthlyPackage;
      const isMonthly = !!(pkg && pkg.status === 'ACTIVE');
      const activeVehicle = vehicle;

      // Flow A: Active Booking exists
      if (state.activeBooking) {
        const activeBooking = state.activeBooking;
        const totalCapacity = activeBooking.floor.capacity;
        const activeParkingCount = await tx.checkInRecord.count({
          where: { floorId: activeBooking.floorId, checkOutTime: null },
        });

        if (activeParkingCount >= totalCapacity) {
          throw new AppError(400, `Tầng ${activeBooking.floor.name} đã đầy xe, không thể nhận thêm.`);
        }

        const checkInTime = new Date();
        const record = await tx.checkInRecord.create({
          data: {
            vehicleId: activeBooking.vehicleId,
            slotId: null,
            floorId: activeBooking.floorId,
            bookingId: activeBooking.id,
            checkInTime,
            isMonthly: false,
          },
          include: { slot: true, vehicle: { include: { owner: true } } },
        });

        await tx.booking.update({
          where: { id: activeBooking.id },
          data: { status: 'FULFILLED' },
        });

        return record;
      }

      // Flow B: Monthly package
      if (isMonthly && pkg) {
        const floorId = pkg.floorId;
        if (!floorId) {
          throw new AppError(400, 'Gói tháng chưa được bố trí tầng đỗ xe. Vui lòng liên hệ ban quản lý.');
        }
        const allowedTier = pkg.allowedTier;

        // Validate capacity
        const physicalCapacity = await tx.parkingSlot.count({
          where: {
            floorId,
            type: activeVehicle.type,
            tier: allowedTier,
          },
        });

        const currentOccupancy = await tx.checkInRecord.count({
          where: {
            floorId,
            allowedTier,
            checkOutTime: null,
          },
        });

        if (currentOccupancy >= physicalCapacity) {
          const zoneName = allowedTier === 'VIP' ? 'Khu VIP' : allowedTier === 'POPULAR' ? 'Khu Phổ biến' : 'Khu Cơ bản';
          throw new AppError(400, `Khu vực đỗ xe ${zoneName} tại tầng đã hết chỗ trống.`);
        }

        // Create CheckInRecord (no slotId)
        const record = await tx.checkInRecord.create({
          data: {
            vehicleId: activeVehicle.id,
            slotId: null,
            floorId,
            isMonthly: true,
            allowedTier,
          },
          include: { slot: true, vehicle: { include: { owner: true } } },
        });

        return record;
      }

      // Flow C: Casual Walk-in
      let targetSlotId: string;
      const zone: 'MONTHLY' | 'CASUAL' = 'CASUAL';

      if (input.slotId) {
        const manualSlot = await tx.parkingSlot.findUnique({
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
        targetSlotId = slot.slotId;
      }

      const slot = await tx.parkingSlot.findUnique({ where: { id: targetSlotId } });
      if (!slot) throw new AppError(404, 'Slot not found');
      if (slot.status !== SLOT_AVAILABLE) {
        throw new AppError(409, 'Selected slot is not available');
      }
      if (slot.type !== activeVehicle.type && activeVehicle.type === 'MOTORBIKE') {
      } else if (slot.type !== activeVehicle.type) {
        throw new AppError(400, 'Slot type does not match vehicle type');
      }

      await tx.parkingSlot.update({
        where: { id: targetSlotId },
        data: { status: SLOT_OCCUPIED },
      });

      const record = await tx.checkInRecord.create({
        data: {
          vehicleId: activeVehicle.id,
          slotId: targetSlotId,
          floorId: slot.floorId,
          isMonthly,
        },
        include: { slot: true, vehicle: { include: { owner: true } } },
      });

      return record;
    });
  },

  async getActiveRecords() {
    return prisma.checkInRecord.findMany({
      where: { checkOutTime: null },
      orderBy: { checkInTime: 'desc' },
      include: {
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
        vehicle: { include: { owner: true } },
      },
    });
  },

  async getHistoryRecords(plateNumber?: string, limit = 100, from?: Date, to?: Date) {
    const checkInWhere: any = {};
    if (plateNumber) {
      checkInWhere.vehicle = {
        plateNumber: {
          contains: plateNumber,
        },
      };
    }
    if (from || to) {
      checkInWhere.OR = [
        { checkInTime: { gte: from || undefined, lte: to || undefined } },
        { checkOutTime: { gte: from || undefined, lte: to || undefined } },
      ];
    }

    const bookingWhere: any = {
      status: { in: ['ACTIVE', 'CANCELLED', 'NO_SHOW'] },
    };
    if (plateNumber) {
      bookingWhere.vehicle = {
        plateNumber: {
          contains: plateNumber,
        },
      };
    }
    if (from || to) {
      bookingWhere.bookingTime = { gte: from || undefined, lte: to || undefined };
    }

    const [checkIns, bookings] = await Promise.all([
      prisma.checkInRecord.findMany({
        where: checkInWhere,
        take: limit,
        orderBy: { checkInTime: 'desc' },
        include: {
          slot: {
            include: {
              floor: true,
            },
          },
          floor: true,
          vehicle: { include: { owner: true } },
          payments: true,
        },
      }),
      prisma.booking.findMany({
        where: bookingWhere,
        take: limit,
        orderBy: { expectedArrival: 'desc' },
        include: {
          floor: true,
          vehicle: { include: { owner: true } },
        },
      }),
    ]);

    const mappedCheckIns = checkIns.map((r) => ({
      id: r.id,
      recordType: 'CHECKIN',
      plateNumber: r.vehicle.plateNumber,
      vehicleType: r.vehicle.type,
      slotCode: r.slot?.code ?? null,
      floorId: r.floorId ?? r.slot?.floorId ?? null,
      floorName: r.floor?.name ?? r.slot?.floor?.name ?? null,
      parkingArea: r.floor?.name ?? r.slot?.floor?.name ?? null,
      timeIn: r.checkInTime.toISOString(),
      timeOut: r.checkOutTime ? r.checkOutTime.toISOString() : null,
      status: r.checkOutTime ? 'COMPLETED' : 'PARKING',
      isMonthly: r.isMonthly || r.vehicle.isMonthly,
      amount: r.payments?.reduce((sum, p) => sum + (p.status === 'SUCCESS' ? parseFloat(String(p.amount)) : 0), 0) ?? 0,
      isLostTicket: r.isLostTicket,
      expectedArrival: null,
      bookingTime: null,
      driverName: r.vehicle.owner?.fullName || null,
      driverEmail: r.vehicle.owner?.email || null,
    }));

    const mappedBookings = bookings.map((b) => ({
      id: b.id,
      recordType: 'BOOKING',
      plateNumber: b.vehicle.plateNumber,
      vehicleType: b.vehicle.type,
      slotCode: null,
      floorId: b.floorId,
      floorName: b.floor?.name ?? null,
      parkingArea: b.floor?.name ?? null,
      timeIn: null,
      timeOut: null,
      status: b.status,
      isMonthly: b.vehicle.isMonthly,
      amount: b.depositStatus === 'PAID' ? parseFloat(String(b.depositAmount)) : 0,
      isLostTicket: false,
      expectedArrival: b.expectedArrival.toISOString(),
      bookingTime: b.bookingTime.toISOString(),
      driverName: b.vehicle.owner?.fullName || null,
      driverEmail: b.vehicle.owner?.email || null,
    }));

    const combined = [...mappedCheckIns, ...mappedBookings];
    combined.sort((a, b) => {
      const timeA = new Date(a.timeIn || a.expectedArrival || 0).getTime();
      const timeB = new Date(b.timeIn || b.expectedArrival || 0).getTime();
      return timeB - timeA;
    });

    return combined.slice(0, limit);
  },

  async getHistoryDetail(recordId: string) {
    const record = await prisma.checkInRecord.findUnique({
      where: { id: recordId },
      include: {
        vehicle: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
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
        payments: {
          include: {
            collectedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        checkedInBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        checkedOutBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        booking: {
          include: {
            floor: true,
          },
        },
        guestCredential: true,
      },
    });

    if (!record) {
      throw new AppError(404, 'Không tìm thấy hồ sơ lượt gửi xe');
    }

    const floorObj = record.floor ?? record.slot?.floor ?? null;
    const durationMinutes = Math.max(
      0,
      Math.round(
        ((record.checkOutTime ? new Date(record.checkOutTime).getTime() : Date.now()) -
          new Date(record.checkInTime).getTime()) /
          60000
      )
    );

    const totalAmount =
      record.payments?.reduce(
        (sum, p) => (p.status === 'SUCCESS' ? sum + parseFloat(String(p.amount)) : sum),
        0
      ) ?? 0;

    let customerType: 'monthly' | 'booking' | 'casual' = 'casual';
    if (record.isMonthly || record.vehicle.isMonthly) {
      customerType = 'monthly';
    } else if (record.bookingId) {
      customerType = 'booking';
    }

    const driverObj = record.driver ?? record.vehicle.owner ?? null;

    return {
      id: record.id,
      recordType: 'CHECKIN' as const,
      status: record.checkOutTime ? ('COMPLETED' as const) : ('PARKING' as const),
      isMonthly: record.isMonthly || record.vehicle.isMonthly,
      isLostTicket: record.isLostTicket,
      lostTicketReason: record.lostTicketReason,
      lostTicketFullName: record.lostTicketFullName,
      lostTicketPhone: record.lostTicketPhone,
      allowedTier: record.allowedTier ?? null,
      checkInTime: record.checkInTime.toISOString(),
      checkOutTime: record.checkOutTime ? record.checkOutTime.toISOString() : null,
      durationMinutes,

      vehicle: {
        id: record.vehicle.id,
        plateNumber: record.vehicle.plateNumber,
        type: record.vehicle.type as 'CAR' | 'MOTORBIKE',
        brand: record.vehicle.brand ?? null,
        model: record.vehicle.model ?? null,
        color: record.vehicle.color ?? null,
        year: record.vehicle.year ?? null,
        seats: record.vehicle.seats ?? null,
      },

      customerType,

      driver: driverObj
        ? {
            id: driverObj.id,
            fullName: driverObj.fullName,
            email: driverObj.email,
            phoneNumber: driverObj.phoneNumber ?? null,
          }
        : null,

      location: {
        floorId: floorObj?.id ?? record.floorId ?? null,
        floorName: floorObj?.name ?? null,
        floorCode: floorObj?.floorCode ?? null,
        slotCode: record.slot?.code ?? null,
        parkingArea: floorObj?.name ?? null,
      },

      checkInEvidence: {
        frontImageUrl: record.frontImageUrl ?? null,
        rearImageUrl: record.rearImageUrl ?? null,
        driverImageUrl: record.driverCheckInImageUrl ?? null,
        driverFaceCapturedAt: record.driverFaceCapturedAt ? record.driverFaceCapturedAt.toISOString() : null,
      },

      checkOutEvidence: {
        frontImageUrl: record.frontCheckOutImageUrl ?? null,
        rearImageUrl: record.rearCheckOutImageUrl ?? null,
        driverImageUrl: record.driverCheckOutImageUrl ?? null,
      },

      payment: {
        totalAmount,
        payments: record.payments.map((p) => ({
          id: p.id,
          amount: parseFloat(String(p.amount)),
          method: p.method,
          type: p.type,
          status: p.status,
          paidAt: p.paidAt ? p.paidAt.toISOString() : null,
          transactionCode: p.transactionCode ?? null,
          collectedBy: p.collectedBy ? p.collectedBy.fullName : null,
        })),
      },

      checkedInBy: record.checkedInBy
        ? {
            id: record.checkedInBy.id,
            fullName: record.checkedInBy.fullName,
            email: record.checkedInBy.email,
          }
        : null,

      checkedOutBy: record.checkedOutBy
        ? {
            id: record.checkedOutBy.id,
            fullName: record.checkedOutBy.fullName,
            email: record.checkedOutBy.email,
          }
        : null,

      booking: record.booking
        ? {
            id: record.booking.id,
            depositAmount: parseFloat(String(record.booking.depositAmount)),
            depositStatus: record.booking.depositStatus,
            bookingTime: record.booking.bookingTime.toISOString(),
            expectedArrival: record.booking.expectedArrival.toISOString(),
          }
        : null,
    };
  },
};
