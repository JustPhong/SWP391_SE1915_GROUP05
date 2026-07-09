import prisma from '../config/db';

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
      slotCode: record.slot.code,
      floor: floorIdToLabel(record.slot.floorId),
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
        slot: true,
        payments: {
          where: { type: 'SESSION' },
          orderBy: { paidAt: 'desc' },
          take: 1,
        },
      },
    });

    const bookings = await prisma.booking.findMany({
      where: {
        createdById: userId,
        status: 'ACTIVE',
      },
      orderBy: { expectedArrival: 'desc' },
      include: {
        vehicle: true,
        slot: true,
      },
    });

    const recordEntries = records.map((record) => ({
      id: record.id,
      plateNumber: record.vehicle.plateNumber,
      slotCode: record.slot.code,
      date: formatISODate(record.checkOutTime ?? record.checkInTime),
      duration: formatDuration(record.checkInTime, record.checkOutTime ?? new Date()),
      amount: Number(record.payments[0]?.amount ?? 0),
      status: record.checkOutTime ? 'Hoàn thành' : 'Đang đỗ',
    }));

    const bookingEntries = bookings.map((b) => ({
      id: b.id,
      plateNumber: b.vehicle.plateNumber,
      slotCode: b.slot.code,
      date: formatISODate(b.expectedArrival),
      duration: 'Chờ xe vào',
      amount: Number(b.depositAmount),
      status: 'Đã đặt chỗ',
    }));

    const combined = [...recordEntries, ...bookingEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return combined;
  },
};
