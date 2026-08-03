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
   
function floorIdToLabel(floorId: number) {
  const labels: Record<number, string> = { 1: 'Tầng G', 2: 'Tầng 1', 3: 'Tầng 2', 4: 'Tầng 3' };
  return labels[floorId] ?? `Tầng ${floorId}`;
}

export const driverDashboardService = {
  async getCurrentSession(userId: string) {
    const record = await prisma.checkInRecord.findFirst({
      where: {
        checkOutTime: null,
        vehicle: {
          ownerId: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        slot: { include: { floor: true } },
        vehicle: true,
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      plateNumber: record.vehicle.plateNumber,
      slotCode: record.slot?.code ?? (record.allowedTier ? `Khu ${record.allowedTier === 'VIP' ? 'VIP' : record.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      floor: record.slot ? floorIdToLabel(record.slot.floorId) : 'Tầng G',
      checkInTime: formatISODate(record.checkInTime),
      estimatedAmount: record.isMonthly ? null : Math.ceil((Date.now() - record.checkInTime.getTime()) / (1000 * 60 * 60)) * SESSION_RATE,
      customerType: record.isMonthly ? 'MONTHLY' : 'CASUAL',
      isMonthly: record.isMonthly,
    };
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
