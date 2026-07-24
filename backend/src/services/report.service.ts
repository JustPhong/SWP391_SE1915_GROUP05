import prisma from '../config/db';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
      if (!p.paidAt) continue;
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
    let sessionRevenue = 0;
    let monthlyRevenue = 0;

    if (isRange) {
      // Revenue in period
      const payments = await prisma.payment.findMany({
        where: {
          paidAt: { gte: from, lte: to },
          type: { in: [PAYMENT_SESSION, PAYMENT_MONTHLY] },
        },
      });
      periodRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      sessionRevenue = payments
        .filter((p) => p.type === PAYMENT_SESSION)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      monthlyRevenue = payments
        .filter((p) => p.type === PAYMENT_MONTHLY)
        .reduce((sum, p) => sum + Number(p.amount), 0);

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
      sessionRevenue = todayPayments
        .filter((p) => p.type === PAYMENT_SESSION)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      monthlyRevenue = todayPayments
        .filter((p) => p.type === PAYMENT_MONTHLY)
        .reduce((sum, p) => sum + Number(p.amount), 0);
    }

    return {
      vehiclesParked: periodVehiclesParked,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      monthlySubscribers: activePackages,
      todayRevenue: periodRevenue,
      sessionRevenue,
      monthlyRevenue,
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
      if (!p.paidAt) continue;
      const day = formatLocalDate(new Date(p.paidAt));
      byDayMap[day] = (byDayMap[day] || 0) + Number(p.amount);
    }

    const result: { date: string; amount: number }[] = [];

    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(to);
    endDay.setHours(23, 59, 59, 999);

    while (cursor <= endDay) {
      const day = formatLocalDate(cursor);
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

      const day = formatLocalDate(new Date(p.paidAt ?? new Date()));
      if (!byDayMap[day]) byDayMap[day] = { casual: 0, monthly: 0 };

      byDayMap[day][source.toLowerCase() as 'casual' | 'monthly'] += amount;

      const vehicle = isCasual ? p.checkInRecord?.vehicle : p.monthlyPackage?.vehicle;

      return {
        date: new Date(p.paidAt ?? new Date()).toLocaleString('vi-VN', {
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
      const day = formatLocalDate(cursor);
      series.push({ date: day, ...(byDayMap[day] ?? { casual: 0, monthly: 0 }) });
      cursor.setDate(cursor.getDate() + 1);
    }

    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      const amt = Number(p.amount);
      const m = p.method;
      byMethod[m] = (byMethod[m] || 0) + amt;
    }

    return {
      total: casualTotal + monthlyTotal,
      casualTotal,
      monthlyTotal,
      byMethod,
      series,
      transactions: transactions.slice(0, 50),
    };
  },

  // ─── NEW: Revenue comparison (this month vs last month) ───────────────────

  async getRevenueComparison(from?: Date, to?: Date, rangeType?: string) {
    let thisPeriodStart: Date;
    let thisPeriodEnd: Date;
    let prevPeriodStart: Date;
    let prevPeriodEnd: Date;
    let fullPrevStart: Date | null = null;
    let fullPrevEnd: Date | null = null;

    let thisMonthName = '';
    let lastMonthName = '';
    let thisPeriodRangeLabel = '';
    let prevPeriodRangeLabel = '';

    const now = new Date();
    const padZero = (n: number) => String(n).padStart(2, '0');
    const fmtDate = (d: Date) => `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()}`;

    // Standardize current range
    if (from && to) {
      thisPeriodStart = from;
      thisPeriodEnd = to;
    } else {
      // Default to month
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      thisPeriodStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
      thisPeriodEnd = new Date(currentYear, currentMonth, now.getDate(), 23, 59, 59, 999);
    }

    const type = rangeType || 'month';

    if (type === 'today') {
      prevPeriodStart = new Date(thisPeriodStart);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
      prevPeriodStart.setHours(0, 0, 0, 0);

      prevPeriodEnd = new Date(thisPeriodEnd);
      prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
      prevPeriodEnd.setHours(23, 59, 59, 999);

      thisMonthName = 'Hôm nay';
      lastMonthName = 'Hôm qua';
      thisPeriodRangeLabel = fmtDate(thisPeriodStart);
      prevPeriodRangeLabel = fmtDate(prevPeriodStart);
    } else if (type === 'week') {
      prevPeriodStart = new Date(thisPeriodStart);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
      prevPeriodStart.setHours(0, 0, 0, 0);

      prevPeriodEnd = new Date(thisPeriodEnd);
      prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 7);
      prevPeriodEnd.setHours(23, 59, 59, 999);

      fullPrevStart = new Date(thisPeriodStart);
      fullPrevStart.setDate(fullPrevStart.getDate() - 7);
      fullPrevStart.setHours(0, 0, 0, 0);

      fullPrevEnd = new Date(thisPeriodStart);
      fullPrevEnd.setDate(fullPrevEnd.getDate() - 1);
      fullPrevEnd.setHours(23, 59, 59, 999);

      thisMonthName = 'Tuần này';
      lastMonthName = 'Tuần trước';
      thisPeriodRangeLabel = `${fmtDate(thisPeriodStart)} - ${fmtDate(thisPeriodEnd)}`;
      prevPeriodRangeLabel = `${fmtDate(prevPeriodStart)} - ${fmtDate(prevPeriodEnd)}`;
    } else {
      // month
      const currentYear = thisPeriodStart.getFullYear();
      const currentMonth = thisPeriodStart.getMonth();

      let lastMonthYear = currentYear;
      let lastMonth = currentMonth - 1;
      if (lastMonth < 0) {
        lastMonth = 11;
        lastMonthYear -= 1;
      }

      prevPeriodStart = new Date(lastMonthYear, lastMonth, thisPeriodStart.getDate(), 0, 0, 0, 0);
      const lastDayOfLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
      const sameDayOfLastMonth = Math.min(thisPeriodEnd.getDate(), lastDayOfLastMonth);
      prevPeriodEnd = new Date(lastMonthYear, lastMonth, sameDayOfLastMonth, 23, 59, 59, 999);

      fullPrevStart = new Date(lastMonthYear, lastMonth, 1, 0, 0, 0, 0);
      fullPrevEnd = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59, 999);

      thisMonthName = `Tháng ${currentMonth + 1} / ${currentYear}`;
      lastMonthName = `Tháng ${lastMonth + 1} / ${lastMonthYear}`;
      thisPeriodRangeLabel = `${fmtDate(thisPeriodStart)} - ${fmtDate(thisPeriodEnd)}`;
      prevPeriodRangeLabel = `${fmtDate(prevPeriodStart)} - ${fmtDate(prevPeriodEnd)}`;
    }

    const [thisPeriodPayments, prevPeriodPayments, fullPrevPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { paidAt: { gte: thisPeriodStart, lte: thisPeriodEnd } },
      }),
      prisma.payment.findMany({
        where: { paidAt: { gte: prevPeriodStart, lte: prevPeriodEnd } },
      }),
      fullPrevStart && fullPrevEnd
        ? prisma.payment.findMany({
            where: { paidAt: { gte: fullPrevStart, lte: fullPrevEnd } },
          })
        : Promise.resolve([]),
    ]);

    const calculateTotals = (payments: any[]) => {
      let total = 0;
      let casual = 0;
      let monthly = 0;
      for (const p of payments) {
        const amt = Number(p.amount);
        total += amt;
        const isCasual = p.checkInRecordId != null;
        const isMonthly = p.monthlyPackageId != null;
        const source = isCasual && !isMonthly ? 'CASUAL' :
                       isMonthly && !isCasual ? 'MONTHLY' :
                       p.type === PAYMENT_MONTHLY ? 'MONTHLY' : 'CASUAL';
        if (source === 'CASUAL') {
          casual += amt;
        } else {
          monthly += amt;
        }
      }
      return { total, casual, monthly };
    };

    const thisMonth = calculateTotals(thisPeriodPayments);
    const lastMonthSamePeriod = calculateTotals(prevPeriodPayments);
    const lastMonthFull = calculateTotals(fullPrevPayments);

    return {
      thisMonth,
      lastMonthSamePeriod,
      lastMonthFull,
      metadata: {
        thisMonthName,
        lastMonthName,
        thisMonthSamePeriodRange: thisPeriodRangeLabel,
        lastMonthSamePeriodRangeLabel: prevPeriodRangeLabel,
      }
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

  // ─── Parking session log (phân tích thuật toán) ──────────────────────────
async getSessionLog(from: Date, to: Date, vehicleType?: string) {
  const records = await prisma.checkInRecord.findMany({
    where: {
      checkInTime: { gte: from, lte: to },
      ...(vehicleType ? { vehicle: { type: vehicleType } } : {}),
    },
    include: {
      vehicle: { select: { plateNumber: true, type: true, isMonthly: true } },
      slot:    { select: { code: true, floor: { select: { floorCode: true, vehicleType: true, customerType: true } } } },
    },
    orderBy: { checkInTime: 'asc' },
  });

  return records.map((r) => {
    const durationMin = r.checkOutTime
      ? Math.round((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000)
      : null;
    return {
      sessionId:    r.id,
      plate:        r.vehicle.plateNumber,
      vehicleType:  r.vehicle.type,
      isMonthly:    r.isMonthly,
      floorCode:    r.slot?.floor?.floorCode ?? 'G',
      slotCode:     r.slot?.code ?? (r.allowedTier ? `Khu ${r.allowedTier === 'VIP' ? 'VIP' : r.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Không cố định'),
      customerType: r.slot?.floor?.customerType ?? (r.isMonthly ? 'MONTHLY' : 'CASUAL'),
      checkInTime:  r.checkInTime,
      checkOutTime: r.checkOutTime ?? null,
      durationMin,
      isLostTicket: r.isLostTicket,
      status:       r.status,
    };
  });
},

// ─── Export CSV cho phân tích thuật toán ─────────────────────────────────
async exportSessionsCsv(from: Date, to: Date, vehicleType?: string): Promise<string> {
  const sessions = await reportService.getSessionLog(from, to, vehicleType);

  const header = [
    'sessionId', 'plate', 'vehicleType', 'isMonthly',
    'floorCode', 'slotCode', 'customerType',
    'checkInTime', 'checkOutTime', 'durationMin',
    'isLostTicket', 'status',
  ].join(',');

  const rows = sessions.map((s) => [
    s.sessionId,
    s.plate,
    s.vehicleType,
    s.isMonthly,
    s.floorCode,
    s.slotCode,
    s.customerType,
    s.checkInTime.toISOString(),
    s.checkOutTime ? new Date(s.checkOutTime).toISOString() : '',
    s.durationMin ?? '',
    s.isLostTicket,
    s.status,
  ].join(','));

  return [header, ...rows].join('\n');
},
};

