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
  // When from/to are provided, vehiclesParked and revenue reflect that period.
  // monthlySubscribers is always a live snapshot (range-independent).

  async getManagerSummary(from?: Date, to?: Date) {
    const now = new Date();

    const isRange = from && to;

    const [totalSlots, occupiedSlots, activePackages] = await Promise.all([
      prisma.parkingSlot.count(),
      prisma.parkingSlot.count({ where: { status: SLOT_OCCUPIED } }),
      prisma.monthlyPackage.count({
        where: { status: PKG_ACTIVE, expiryDate: { gt: now } },
      }),
    ]);

    const occupancyRate = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

    let periodRevenue = 0;
    let periodVehiclesParked = 0;

    if (isRange) {
      // Revenue in period
      const payments = await prisma.payment.findMany({
        where: {
          paidAt: { gte: from, lte: to },
          type: { in: [PAYMENT_SESSION, PAYMENT_MONTHLY] },
        },
      });
      periodRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Entries in period (not currently parked)
      periodVehiclesParked = await prisma.checkInRecord.count({
        where: { checkInTime: { gte: from, lte: to } },
      });
    } else {
      // Legacy: today-only snapshot
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      periodVehiclesParked = await prisma.checkInRecord.count({ where: { checkOutTime: null } });

      const todayPayments = await prisma.payment.findMany({
        where: {
          paidAt: { gte: todayStart, lte: todayEnd },
          type: { in: [PAYMENT_SESSION, PAYMENT_MONTHLY] },
        },
      });
      periodRevenue = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    }

    return {
      vehiclesParked: periodVehiclesParked,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      monthlySubscribers: activePackages,
      todayRevenue: periodRevenue,
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
  // When from/to are provided, returns entries in that period.
  // When omitted, returns currently-parked counts (legacy snapshot).

  async getVehiclesByType(from?: Date, to?: Date) {
    let car = 0;
    let motorbike = 0;

    if (from && to) {
      // Entries in period
      const records = await prisma.checkInRecord.findMany({
        where: { checkInTime: { gte: from, lte: to } },
        select: { vehicle: { select: { type: true } } },
      });
      for (const record of records) {
        const t = record.vehicle.type.toUpperCase();
        if (t === 'CAR') car++;
        else if (t === 'MOTORBIKE') motorbike++;
      }
    } else {
      // Current snapshot (legacy)
      const activeRecords = await prisma.checkInRecord.findMany({
        where: { checkOutTime: null },
        select: { vehicle: { select: { type: true } } },
      });
      for (const record of activeRecords) {
        const t = record.vehicle.type.toUpperCase();
        if (t === 'CAR') car++;
        else if (t === 'MOTORBIKE') motorbike++;
      }
    }

    return { car, motorbike };
  },

  // ─── Occupancy detail — per-floor slot breakdown (MANAGER + ADMIN) ─────────────

  async getOccupancyDetail() {
    const floors = await prisma.floor.findMany({
      orderBy: { floorCode: 'asc' },
      include: {
        slots: {
          orderBy: { code: 'asc' },
          select: { code: true, status: true },
        },
      },
    });

    const totalCapacity = floors.reduce((sum, f) => sum + f.capacity, 0);
    let totalOccupied = 0;
    let totalReserved = 0;
    let totalAvailable = 0;

    const floorResults = floors.map((floor) => {
      const capacity = floor.capacity;
      const slots = floor.slots ?? [];
      const occupied = slots.filter((s) => s.status === SLOT_OCCUPIED).length;
      const reserved = slots.filter((s) => s.status === SLOT_RESERVED).length;
      const available = capacity - occupied - reserved;

      totalOccupied += occupied;
      totalReserved += reserved;
      totalAvailable += available;

      // Build slotCode → display label (e.g. "G-01", "1-01", "2-01", "3-01")
      const displaySlots = slots.map((s) => ({
        code: s.code,
        status: s.status as 'AVAILABLE' | 'OCCUPIED' | 'RESERVED',
      }));

      return {
        floorCode: floor.floorCode as string,
        vehicleType: floor.vehicleType as 'CAR' | 'MOTORBIKE',
        customerType: floor.customerType as 'MONTHLY' | 'CASUAL',
        capacity,
        occupied,
        available,
        reserved,
        rate: capacity > 0 ? Math.round((occupied / capacity) * 100 * 10) / 10 : 0,
        slots: displaySlots,
      };
    });

    const overallRate =
      totalCapacity > 0
        ? Math.round((totalOccupied / totalCapacity) * 100 * 10) / 10
        : 0;

    return {
      totalCapacity,
      totalOccupied,
      overallRate,
      floors: floorResults,
    };
  },

  // ─── Traffic — entries/exits per day and hour (MANAGER + ADMIN) ──────────────

  async getTraffic(from: Date, to: Date) {
    const records = await prisma.checkInRecord.findMany({
      where: {
        OR: [
          { checkInTime: { gte: from, lte: to } },
          { checkOutTime: { gte: from, lte: to } },
        ],
      },
      include: { vehicle: { select: { type: true } } },
    });

    const totalIn = records.filter((r) => r.checkInTime >= from && r.checkInTime <= to).length;
    const totalOut = records.filter(
      (r) => r.checkOutTime != null && r.checkOutTime >= from && r.checkOutTime <= to
    ).length;
    const currentlyParked = records.filter((r) => r.checkOutTime == null).length;

    const byVehicleType: Record<string, number> = { car: 0, motorbike: 0 };
    for (const r of records) {
      if (r.checkInTime >= from && r.checkInTime <= to) {
        const t = r.vehicle.type.toUpperCase();
        if (t === 'CAR') byVehicleType.car++;
        else if (t === 'MOTORBIKE') byVehicleType.motorbike++;
      }
    }

    // Daily: fill every day in range
    const dailyIn: Record<string, number> = {};
    const dailyOut: Record<string, number> = {};
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    while (cursor <= end) {
      const day = cursor.toISOString().split('T')[0];
      dailyIn[day] = 0;
      dailyOut[day] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const r of records) {
      const inDay = new Date(r.checkInTime).toISOString().split('T')[0];
      if (inDay in dailyIn) dailyIn[inDay]++;
      if (r.checkOutTime) {
        const outDay = new Date(r.checkOutTime).toISOString().split('T')[0];
        if (outDay in dailyOut) dailyOut[outDay]++;
      }
    }
    const daily = Object.keys(dailyIn)
      .sort()
      .map((date) => ({ date, in: dailyIn[date], out: dailyOut[date] }));

    // Hourly: aggregate all check-ins by hour-of-day (0–23)
    const hourlyIn: number[] = Array.from({ length: 24 }, () => 0);
    for (const r of records) {
      if (r.checkInTime >= from && r.checkInTime <= to) {
        hourlyIn[new Date(r.checkInTime).getHours()]++;
      }
    }
    const hourly = hourlyIn.map((inCount, hour) => ({ hour, in: inCount, out: 0 }));

    // Peak hour
    let peakHour: { hour: number; count: number } | null = null;
    for (let h = 0; h < 24; h++) {
      if (!peakHour || hourlyIn[h] > peakHour.count) {
        peakHour = { hour: h, count: hourlyIn[h] };
      }
    }
    if (peakHour && peakHour.count === 0) peakHour = null;

    return {
      totalIn,
      totalOut,
      currentlyParked,
      byVehicleType: {
        car: byVehicleType.car,
        motorbike: byVehicleType.motorbike,
      },
      daily,
      hourly,
      peakHour,
    };
  },
};
