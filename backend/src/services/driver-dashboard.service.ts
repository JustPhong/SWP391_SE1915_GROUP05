import prisma from '../config/db';
import { calcFee } from '../utils/fee';
import { feeRuleService } from './feeRule.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Service ─────────────────────────────────────────────────────────────────

export const driverDashboardService = {
  async getCurrentSession(userId: string) {
    const records = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        driverId: userId,
      },
      orderBy: { checkInTime: 'desc' },
      include: {
        slot: { include: { floor: true } },
        floor: true,
        vehicle: true,
        payments: true,
      },
    });

    if (records.length === 0) return [];

    // Capture once per request — same reference timestamp for all sessions.
    const calculatedAt = new Date();
    const feeConfig = await feeRuleService.getFeeConfig();

    return records.map((record) => {
      const checkIn = new Date(record.checkInTime);
      const durationMinutes = Math.round(
        (calculatedAt.getTime() - checkIn.getTime()) / 60_000
      );

      // ── Payment status ──────────────────────────────────────────────────────
      let paymentStatus: 'UNPAID' | 'PENDING' | 'SUCCESS' = 'UNPAID';
      if (record.isMonthly) {
        paymentStatus = 'SUCCESS';
      } else {
        const hasSuccess = record.payments.some(
          (p) => p.status === 'SUCCESS' && p.type === 'PARKING_FEE'
        );
        if (hasSuccess) {
          paymentStatus = 'SUCCESS';
        } else {
          const hasPending = record.payments.some((p) => p.status === 'PENDING');
          if (hasPending) paymentStatus = 'PENDING';
        }
      }

      // ── Authoritative fee — same inputs as staff checkout ──────────────────
      let estimatedAmount: number | null = null;
      if (!record.isMonthly) {
        const vehicleType = record.vehicle.type as 'CAR' | 'MOTORBIKE';
        const { total } = calcFee(checkIn, calculatedAt, vehicleType, feeConfig);

        // Deduct any successfully-paid PARKING_FEE so we don't show double-charge
        const totalPaid = record.payments.reduce(
          (sum, p) =>
            sum +
            (p.status === 'SUCCESS' && p.type === 'PARKING_FEE'
              ? parseFloat(String(p.amount))
              : 0),
          0
        );

        // Honour prepaid grace window (same as staff checkout: 5 min after prepaidAt)
        let graceActive = false;
        if (record.prepaidAt) {
          const graceEnd = new Date(
            new Date(record.prepaidAt).getTime() + 300_000
          );
          graceActive = calculatedAt <= graceEnd;
        }

        estimatedAmount = graceActive ? 0 : Math.max(0, total - totalPaid);
      }

      return {
        id: record.id,
        vehicleId: record.vehicleId,
        plateNumber: record.vehicle.plateNumber,
        vehicleType: record.vehicle.type as 'CAR' | 'MOTORBIKE',
        slotCode:
          record.slot?.code ??
          (record.allowedTier
            ? `Khu ${
                record.allowedTier === 'VIP'
                  ? 'VIP'
                  : record.allowedTier === 'POPULAR'
                  ? 'Phổ biến'
                  : 'Cơ bản'
              }`
            : 'Không cố định'),
        floor: resolveFloorName(record.slot, record.floor),
        checkInTime: formatISODate(checkIn),
        estimatedAmount,
        calculatedAt: formatISODate(calculatedAt),
        durationMinutes,
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
        expiryDate: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pkg) return null;

    return {
      id: pkg.id,
      planName: pkg.planName ?? 'Gói tháng',
      expiryDate: formatISODate(pkg.expiryDate),
      status: pkg.status,
      effectiveStatus: 'ACTIVE' as const,
      isEffectivelyActive: true,
    };
  },

  async getHistory(userId: string) {
    const records = await prisma.checkInRecord.findMany({
      where: {
        driverId: userId,
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

    if (records.length === 0) return [];

    // Capture once per request — single timestamp and config for all records.
    const calculatedAt = new Date();
    const feeConfig = await feeRuleService.getFeeConfig();

    const recordEntries = records.map((record) => {
      const checkIn = new Date(record.checkInTime);
      const isActive = record.checkOutTime === null && record.status !== 'CANCELLED';
      const vehicleType = record.vehicle.type as 'CAR' | 'MOTORBIKE';

      let normalizedStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'ACTIVE';
      if (record.status === 'CANCELLED') {
        normalizedStatus = 'CANCELLED';
      } else if (record.checkOutTime !== null || record.status === 'COMPLETED') {
        normalizedStatus = 'COMPLETED';
      }

      // ── Amount ─────────────────────────────────────────────────────────────
      // PROVISIONAL for active sessions: authoritative calcFee
      // FINAL for completed sessions: recorded successful-payment sum
      let amount: number;
      let amountType: 'PROVISIONAL' | 'FINAL';

      if (isActive && !record.isMonthly) {
        const { total } = calcFee(checkIn, calculatedAt, vehicleType, feeConfig);
        // Deduct already-paid amounts (same logic as checkout service)
        const totalPaid = record.payments.reduce(
          (sum, p) => sum + parseFloat(String(p.amount)),
          0
        );
        amount = Math.max(0, total - totalPaid);
        amountType = 'PROVISIONAL';
      } else {
        // Completed or monthly: use the final recorded payment sum
        amount = record.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        );
        amountType = 'FINAL';
      }

      const endTime = record.checkOutTime ?? calculatedAt;
      const durationMinutes = Math.round(
        (endTime.getTime() - checkIn.getTime()) / 60_000
      );

      const floorName: string | null =
        record.slot?.floor?.name ?? record.floor?.name ?? null;

      return {
        id: record.id,
        recordType: 'PARKING_SESSION',
        plateNumber: record.vehicle.plateNumber,
        plate: record.vehicle.plateNumber,
        slotCode:
          record.slot?.code ??
          (record.allowedTier
            ? `Khu ${
                record.allowedTier === 'VIP'
                  ? 'VIP'
                  : record.allowedTier === 'POPULAR'
                  ? 'Ph\u1ed5 bi\u1ebfn'
                  : 'C\u01a1 b\u1ea3n'
              }`
            : 'Kh\u00f4ng c\u1ed1 \u0111\u1ecbnh'),
        floor: floorName,
        date: formatISODate(checkIn),
        checkInTime: formatISODate(checkIn),
        checkOutTime: record.checkOutTime ? formatISODate(record.checkOutTime) : null,
        durationMinutes,
        amount,
        amountType,
        status: normalizedStatus,
        vehicleType,
      };
    });

    return recordEntries;
  },
};
