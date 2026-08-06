import prisma from '../config/db';
import { floorService } from './floor.service';

const SESSION_RATE = 5000;

function formatDuration(start: Date, end: Date) {
  const durationMs = end.getTime() - start.getTime();
  const hours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60)));
  return `${hours}h`;
}

function formatISODate(date: Date) {
  return date.toISOString();
}
   
/** Returns a human-readable floor name from the related Floor record, or null. */
function resolveFloorName(
  slot: { floor: { name: string } | null } | null,
  floor: { name: string } | null
): string | null {
  return slot?.floor?.name ?? floor?.name ?? null;
}

export const driverDashboardService = {
  async getCurrentSession(userId: string) {
    const records = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        vehicle: {
          ownerId: userId,
        },
      },
      orderBy: { checkInTime: 'desc' },
      include: {
        slot: { include: { floor: true } },
        floor: true,
        vehicle: true,
        payments: true,
      },
    });

    return records.map((record) => {
      // Determine paymentStatus
      let paymentStatus: 'UNPAID' | 'PENDING' | 'SUCCESS' = 'UNPAID';
      if (record.isMonthly) {
        paymentStatus = 'SUCCESS';
      } else {
        const hasSuccess = record.payments.some(p => p.status === 'SUCCESS' && p.type === 'PARKING_FEE');
        if (hasSuccess) {
          paymentStatus = 'SUCCESS';
        } else {
          const hasPending = record.payments.some(p => p.status === 'PENDING');
          if (hasPending) {
            paymentStatus = 'PENDING';
          }
        }
      }

      return {
        id: record.id,
        vehicleId: record.vehicleId,
        plateNumber: record.vehicle.plateNumber,
        vehicleType: record.vehicle.type as 'CAR' | 'MOTORBIKE',
        slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
        floor: resolveFloorName(record.slot, record.floor),
        checkInTime: formatISODate(record.checkInTime),
        estimatedAmount: record.isMonthly ? null : Math.ceil((Date.now() - record.checkInTime.getTime()) / (1000 * 60 * 60)) * SESSION_RATE,
        customerType: record.isMonthly ? ('MONTHLY' as const) : ('CASUAL' as const),
        isMonthly: record.isMonthly,
        paymentStatus,
      };
    });
  },

  async getMyPackage(userId: string) {
    const pkg = await prisma.monthlyPackage.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pkg) return null;

    return {
      id: pkg.id,
      planName: pkg.planName ?? 'Gói tháng',
      expiryDate: formatISODate(pkg.expiryDate),
      status: pkg.status,
    };
  },

  async getHistory(userId: string) {
    const records = await prisma.checkInRecord.findMany({
      where: {
        vehicle: {
          ownerId: userId,
        },
      },
      orderBy: { checkInTime: 'desc' },
      include: {
        vehicle: true,
        slot: {
          include: {
            floor: true,
          },
        },
        floor: true,
        payments: {
          where: {
            status: 'SUCCESS',
            type: {
              in: ['PARKING_FEE', 'SESSION'],
            },
          },
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    const recordEntries = records.map((record) => {
      let normalizedStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'ACTIVE';
      if (record.status === 'CANCELLED') {
        normalizedStatus = 'CANCELLED';
      } else if (record.checkOutTime !== null || record.status === 'COMPLETED') {
        normalizedStatus = 'COMPLETED';
      }

      return {
        id: record.id,
        recordType: 'PARKING_SESSION',
        plateNumber: record.vehicle.plateNumber,
        plate: record.vehicle.plateNumber,
        slotCode: record.slot?.code ?? record.floor?.name ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
        floor: record.slot?.floor?.name ?? record.floor?.name ?? 'Không cố định',
        date: formatISODate(record.checkInTime),
        checkInTime: formatISODate(record.checkInTime),
        checkOutTime: record.checkOutTime ? formatISODate(record.checkOutTime) : null,
        duration: formatDuration(record.checkInTime, record.checkOutTime ?? new Date()),
        amount: record.payments.reduce((sum, p) => sum + Number(p.amount), 0),
        status: normalizedStatus,
      };
    });

    return recordEntries;
  },
};
