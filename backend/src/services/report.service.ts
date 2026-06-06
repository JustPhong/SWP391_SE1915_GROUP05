import prisma from '../config/db';

const SLOT_AVAILABLE = 'AVAILABLE';
const SLOT_OCCUPIED = 'OCCUPIED';
const SLOT_RESERVED = 'RESERVED';
const PKG_ACTIVE = 'ACTIVE';
const BOOKING_ACTIVE = 'ACTIVE';
const PAYMENT_SESSION = 'SESSION';
const PAYMENT_MONTHLY = 'MONTHLY';

export interface OccupancyReport {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyRate: number;
  byFloor: FloorOccupancy[];
  byVehicleType: VehicleTypeOccupancy[];
}

export interface FloorOccupancy {
  floor: number;
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  occupancyRate: number;
}

export interface VehicleTypeOccupancy {
  type: string;
  total: number;
  available: number;
  occupied: number;
}

export interface RevenueReport {
  totalRevenue: number;
  sessionRevenue: number;
  monthlyRevenue: number;
  transactionCount: number;
  byMethod: Record<string, number>;
  byDay: { date: string; amount: number }[];
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  floorId?: number;
}

export const reportService = {
  // ─── Occupancy (existing, unchanged) ────────────────────────────────────

  async getOccupancyReport(filters?: ReportFilters) {
    const where: any = {};
    if (filters?.floorId !== undefined) where.floorId = filters.floorId;

    const slots = await prisma.parkingSlot.findMany({ where });

    const total = slots.length;
    const available = slots.filter((s) => s.status === SLOT_AVAILABLE).length;
    const occupied = slots.filter((s) => s.status === SLOT_OCCUPIED).length;
    const reserved = slots.filter((s) => s.status === SLOT_RESERVED).length;

    const floorIds = [...new Set(slots.map((s) => s.floorId))].sort((a, b) => a - b);
    const byFloor: FloorOccupancy[] = floorIds.map((floorId) => {
      const fSlots = slots.filter((s) => s.floorId === floorId);
      return {
        floor: floorId,
        total: fSlots.length,
        available: fSlots.filter((s) => s.status === SLOT_AVAILABLE).length,
        occupied: fSlots.filter((s) => s.status === SLOT_OCCUPIED).length,
        reserved: fSlots.filter((s) => s.status === SLOT_RESERVED).length,
        occupancyRate: fSlots.length > 0
          ? (fSlots.filter((s) => s.status === SLOT_OCCUPIED).length / fSlots.length) * 100
          : 0,
      };
    });

    return {
      totalSlots: total,
      availableSlots: available,
      occupiedSlots: occupied,
      reservedSlots: reserved,
      occupancyRate: total > 0 ? (occupied / total) * 100 : 0,
      byFloor,
      byVehicleType: [],
    } as OccupancyReport;
  },

  // ─── Revenue by day range (existing, unchanged) ───────────────────────────

  async getRevenueReport(filters?: ReportFilters) {
    const where: any = {};
    if (filters?.startDate) where.paidAt = { ...where.paidAt, gte: filters.startDate };
    if (filters?.endDate) where.paidAt = { ...where.paidAt, lte: filters.endDate };

    const payments = await prisma.payment.findMany({ where });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const sessionRevenue = payments
      .filter((p) => p.type === PAYMENT_SESSION)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const monthlyRevenue = payments
      .filter((p) => p.type === PAYMENT_MONTHLY)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount);
    }

    const byDayMap: Record<string, number> = {};
    for (const p of payments) {
      const day = new Date(p.paidAt).toISOString().split('T')[0];
      byDayMap[day] = (byDayMap[day] || 0) + Number(p.amount);
    }
    const byDay = Object.entries(byDayMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue,
      sessionRevenue,
      monthlyRevenue,
      transactionCount: payments.length,
      byMethod,
      byDay,
    } as RevenueReport;
  },

  // ─── Active counts (existing, unchanged) ──────────────────────────────────

  async getActiveCheckInsCount() {
    return prisma.checkInRecord.count({ where: { checkOutTime: null } });
  },

  async getActiveBookingsCount() {
    return prisma.booking.count({ where: { status: BOOKING_ACTIVE } });
  },

  async getActivePackagesCount() {
    return prisma.monthlyPackage.count({ where: { status: PKG_ACTIVE } });
  },

  // ─── NEW: Manager KPI summary ──────────────────────────────────────────────

  async getManagerSummary() {
    const now = new Date();

    const [vehiclesParked, totalSlots, occupiedSlots, activePackages, todayStart, todayEnd] =
      await Promise.all([
        prisma.checkInRecord.count({ where: { checkOutTime: null } }),
        prisma.parkingSlot.count(),
        prisma.parkingSlot.count({ where: { status: SLOT_OCCUPIED } }),
        prisma.monthlyPackage.count({
          where: { status: PKG_ACTIVE, expiryDate: { gt: now } },
        }),
        // start of today (local)
        Promise.resolve(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
        // end of today (local) — inclusive, so 23:59:59.999
        Promise.resolve(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)),
      ]);

    const occupancyRate = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

    // Revenue rule: walk-in checkout (SESSION) + monthly package purchase (MONTHLY).
    // Monthly subscribers never pay at checkout — never count SESSION payments
    // for vehicles that checked in as monthly guests.
    const todayPayments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: todayStart, lte: todayEnd },
        type: { in: [PAYMENT_SESSION, PAYMENT_MONTHLY] },
      },
    });

    const todayRevenue = todayPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    return {
      vehiclesParked,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      monthlySubscribers: activePackages,
      todayRevenue,
    };
  },

  // ─── NEW: Revenue per day (YYYY-MM-DD range) ──────────────────────────────

  async getRevenueByDay(from: Date, to: Date) {
    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      orderBy: { paidAt: 'asc' },
    });

    const byDayMap: Record<string, number> = {};
    for (const p of payments) {
      const day = new Date(p.paidAt).toISOString().split('T')[0];
      byDayMap[day] = (byDayMap[day] || 0) + Number(p.amount);
    }

    const result: { date: string; amount: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(to);
    endDay.setHours(23, 59, 59, 999);

    while (cursor <= endDay) {
      const day = cursor.toISOString().split('T')[0];
      result.push({ date: day, amount: byDayMap[day] ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  },

  // ─── NEW: Revenue detail — casual vs monthly breakdown ──────────────────────

  async getRevenueDetail(from: Date, to: Date) {
    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      orderBy: { paidAt: 'desc' },
      include: {
        checkInRecord: {
          include: { vehicle: { include: { owner: true } } },
        },
        monthlyPackage: {
          include: { vehicle: { include: { owner: true } } },
        },
      },
    });

    let casualTotal = 0;
    let monthlyTotal = 0;
    const byDayMap: Record<string, { casual: number; monthly: number }> = {};

    const transactions = payments.map((p) => {
      // Determine source from relation presence — more reliable than type alone
      const isCasual = p.checkInRecordId != null;
      const isMonthly = p.monthlyPackageId != null;
      const amount = Number(p.amount);

      // Classify by the non-null relation; fall back to Payment.type
      const source: 'CASUAL' | 'MONTHLY' =
        isCasual && !isMonthly ? 'CASUAL' :
        isMonthly && !isCasual ? 'MONTHLY' :
        p.type === PAYMENT_MONTHLY ? 'MONTHLY' : 'CASUAL';

      if (source === 'CASUAL') casualTotal += amount;
      else monthlyTotal += amount;

      const day = new Date(p.paidAt).toISOString().split('T')[0];
      if (!byDayMap[day]) byDayMap[day] = { casual: 0, monthly: 0 };
      byDayMap[day][source.toLowerCase() as 'casual' | 'monthly'] += amount;

      const vehicle = isCasual ? p.checkInRecord?.vehicle : p.monthlyPackage?.vehicle;

      return {
        date: new Date(p.paidAt).toLocaleString('vi-VN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).replace(',', ''),
        source,
        plateNumber: vehicle?.plateNumber ?? null,
        customerName: vehicle?.owner?.fullName ?? null,
        amount,
      };
    });

    // Fill all days in range with 0 for missing dates
    const series: { date: string; casual: number; monthly: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(to);
    endDay.setHours(23, 59, 59, 999);
    while (cursor <= endDay) {
      const day = cursor.toISOString().split('T')[0];
      series.push({ date: day, ...(byDayMap[day] ?? { casual: 0, monthly: 0 }) });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      total: casualTotal + monthlyTotal,
      casualTotal,
      monthlyTotal,
      series,
      transactions: transactions.slice(0, 50),
    };
  },

  // ─── Vehicles parked grouped by type ──────────────────────────────────────

  async getVehiclesByType() {
    const activeRecords = await prisma.checkInRecord.findMany({
      where: { checkOutTime: null },
      select: {
        vehicle: {
          select: { type: true },
        },
      },
    });

    let car = 0;
    let motorbike = 0;
    for (const record of activeRecords) {
      const t = record.vehicle.type.toUpperCase();
      if (t === 'CAR') car++;
      else if (t === 'MOTORBIKE') motorbike++;
    }

    return { car, motorbike };
  },
};
