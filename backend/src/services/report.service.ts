import prisma from '../config/db';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ShiftRangeResult {
  start: Date;
  end: Date;
  shiftName: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  dateStr: string;
}

export function getCurrentShiftTimeRange(): ShiftRangeResult {
  // Convert current time to Vietnam time (UTC+7)
  const nowUtc = Date.now();
  const vnOffset = 7 * 60 * 60 * 1000;
  const nowVn = new Date(nowUtc + vnOffset);

  const currentHour = nowVn.getUTCHours();

  // Construct date parts in UTC aligning with local Vietnam date
  const year = nowVn.getUTCFullYear();
  const month = nowVn.getUTCMonth();
  const day = nowVn.getUTCDate();

  let shiftName: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  let startHourLocal: number;
  let endHourLocal: number;
  let dayOffsetStart = 0;
  let dayOffsetEnd = 0;

  if (currentHour >= 6 && currentHour < 14) {
    shiftName = 'MORNING';
    startHourLocal = 6;
    endHourLocal = 14;
  } else if (currentHour >= 14 && currentHour < 22) {
    shiftName = 'AFTERNOON';
    startHourLocal = 14;
    endHourLocal = 22;
  } else {
    shiftName = 'NIGHT';
    startHourLocal = 22;
    if (currentHour >= 22) {
      endHourLocal = 6;
      dayOffsetEnd = 1;
    } else {
      endHourLocal = 6;
      dayOffsetStart = -1;
    }
  }

  // Construct UTC Dates that match Vietnam local hours:
  const start = new Date(Date.UTC(year, month, day + dayOffsetStart, startHourLocal - 7, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, day + dayOffsetEnd, endHourLocal - 7, 0, 0, 0));

  // Calculate dateStr ('YYYY-MM-DD' in local Vietnam time)
  const shiftDateVn = new Date(nowVn.getTime() + dayOffsetStart * 24 * 60 * 60 * 1000);
  const yyyy = shiftDateVn.getUTCFullYear();
  const mm = String(shiftDateVn.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shiftDateVn.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return { start, end, shiftName, dateStr };
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
    const now = new Date();
    const whereFloor: any = {};
    if (filters?.floorId !== undefined) {
      whereFloor.id = filters.floorId;
    }

    const floors = await prisma.floor.findMany({
      where: whereFloor,
      orderBy: { id: 'asc' },
    });

    const activeCheckins = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        status: 'PARKING',
        ...(filters?.floorId !== undefined ? { floorId: filters.floorId } : {}),
      },
    });

    const activeBookings = await prisma.booking.findMany({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        expiresAt: { gt: now },
        checkInRecords: { none: {} },
        ...(filters?.floorId !== undefined ? { floorId: filters.floorId } : {}),
      },
    });

    let totalCapacity = 0;
    let totalOccupied = 0;
    let totalReserved = 0;
    let totalAvailable = 0;

    const byFloor: FloorOccupancy[] = floors.map((floor) => {
      const fCapacity = floor.capacity;
      const fOccupied = activeCheckins.filter((c) => c.floorId === floor.id).length;
      const fReserved = activeBookings.filter((b) => b.floorId === floor.id).length;
      const fAvailable = fCapacity - fOccupied - fReserved;

      totalCapacity += fCapacity;
      totalOccupied += fOccupied;
      totalReserved += fReserved;
      totalAvailable += fAvailable;

      return {
        floor: floor.id,
        total: fCapacity,
        available: fAvailable,
        occupied: fOccupied,
        reserved: fReserved,
        occupancyRate: fCapacity > 0 ? (fOccupied / fCapacity) * 100 : 0,
      };
    });

    return {
      totalSlots: totalCapacity,
      availableSlots: totalAvailable,
      occupiedSlots: totalOccupied,
      reservedSlots: totalReserved,
      occupancyRate: totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0,
      byFloor,
      byVehicleType: [],
    } as OccupancyReport;
  },

  // ─── Revenue by day range (existing, unchanged) ───────────────────────────

  async getRevenueReport(filters?: ReportFilters) {
    const now = new Date();
    const where: any = {};

    let startLimit: Date | undefined = filters?.startDate;
    let endLimit: Date | undefined = filters?.endDate;

    // Timezone safety and clamping for active shifts
    if (endLimit && endLimit > now) {
      endLimit = now;
    }

    const payments = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        paidAt: {
          not: null,
          ...(startLimit ? { gte: startLimit } : {}),
          ...(endLimit ? { lte: endLimit } : {}),
        },
      }
    });

    const paidPayments = payments.filter(
      (p): p is typeof p & { paidAt: Date } =>
        p.status === 'SUCCESS' &&
        p.paidAt instanceof Date
    );

    const sessionTypes = [PAYMENT_SESSION, 'PARKING_FEE'];
    const monthlyTypes = [PAYMENT_MONTHLY, 'MONTHLY_PACKAGE'];
    const bookingTypes = ['BOOKING_FEE', 'BOOKING_DEPOSIT'];

    const parkingRevenue = paidPayments
      .filter((p) => sessionTypes.includes(p.type))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const monthlyRevenue = paidPayments
      .filter((p) => monthlyTypes.includes(p.type))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const bookingRevenue = paidPayments
      .filter((p) => bookingTypes.includes(p.type))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const otherRevenue = paidPayments
      .filter((p) => !sessionTypes.includes(p.type) && !monthlyTypes.includes(p.type) && !bookingTypes.includes(p.type))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRevenue = parkingRevenue + monthlyRevenue + bookingRevenue + otherRevenue;

    // Development diagnostics logging
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV) {
      console.log(`[SHIFT_REVENUE] startUtc=${startLimit ? startLimit.toISOString() : 'undefined'}`);
      console.log(`[SHIFT_REVENUE] effectiveEndUtc=${endLimit ? endLimit.toISOString() : 'undefined'}`);
      console.log(`[SHIFT_REVENUE] successfulPaymentsFound=${paidPayments.length}`);
      console.log(`[SHIFT_REVENUE] totalRevenue=${totalRevenue}`);
    }

    const byMethod: Record<string, number> = {};
    for (const p of paidPayments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount);
    }

    // Diagnostic validation checks (development-only warnings)
    const sumMethodRevenue = Object.values(byMethod).reduce((sum, amt) => sum + amt, 0);
    if (Math.abs(sumMethodRevenue - totalRevenue) > 0.01) {
      console.warn(`[Report Diagnostic Warning] Method sum (${sumMethodRevenue}) does not equal totalRevenue (${totalRevenue})`);
    }
    const sumBreakdownRevenue = parkingRevenue + monthlyRevenue + bookingRevenue + otherRevenue;
    if (Math.abs(sumBreakdownRevenue - totalRevenue) > 0.01) {
      console.warn(`[Report Diagnostic Warning] Breakdown sum (${sumBreakdownRevenue}) does not equal totalRevenue (${totalRevenue})`);
    }

    const byDayMap: Record<string, number> = {};
    for (const p of paidPayments) {
      const day = new Date(p.paidAt).toISOString().split('T')[0];
      byDayMap[day] = (byDayMap[day] || 0) + Number(p.amount);
    }
    const byDay = Object.entries(byDayMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue,
      sessionRevenue: parkingRevenue,
      monthlyRevenue,
      bookingRevenue,
      transactionCount: paidPayments.length,
      byMethod,
      byDay,
    };
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
      prisma.floor.findMany().then((floors) => floors.reduce((sum, f) => sum + f.capacity, 0)),
      prisma.checkInRecord.count({ where: { checkOutTime: null, status: 'PARKING' } }),
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
          status: 'SUCCESS',
          type: { in: [PAYMENT_SESSION, PAYMENT_MONTHLY, 'PARKING_FEE', 'MONTHLY_PACKAGE'] },
        },
      });

      const paidPayments = payments.filter(
        (p): p is typeof p & { paidAt: Date } =>
          p.status === 'SUCCESS' &&
          p.paidAt instanceof Date
      );

      periodRevenue = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      sessionRevenue = paidPayments
        .filter((p) => p.type === PAYMENT_SESSION || p.type === 'PARKING_FEE')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      monthlyRevenue = paidPayments
        .filter((p) => p.type === PAYMENT_MONTHLY || p.type === 'MONTHLY_PACKAGE')
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
          status: 'SUCCESS',
          type: { in: [PAYMENT_SESSION, PAYMENT_MONTHLY, 'PARKING_FEE', 'MONTHLY_PACKAGE'] },
        },
      });

      const paidTodayPayments = todayPayments.filter(
        (p): p is typeof p & { paidAt: Date } =>
          p.status === 'SUCCESS' &&
          p.paidAt instanceof Date
      );

      periodRevenue = paidTodayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      sessionRevenue = paidTodayPayments
        .filter((p) => p.type === PAYMENT_SESSION || p.type === 'PARKING_FEE')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      monthlyRevenue = paidTodayPayments
        .filter((p) => p.type === PAYMENT_MONTHLY || p.type === 'MONTHLY_PACKAGE')
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
      where: {
        paidAt: { gte: from, lte: to },
        status: 'SUCCESS',
      },
      orderBy: { paidAt: 'asc' },
    });

    const byDayMap: Record<string, number> = {};
    for (const p of payments) {
      if (p.status !== 'SUCCESS' || !p.paidAt) {
        continue;
      }
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
      where: {
        paidAt: { gte: from, lte: to },
        status: 'SUCCESS',
      },
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

    const paidPayments = payments.filter(
      (p): p is typeof p & { paidAt: Date } =>
        p.status === 'SUCCESS' &&
        p.paidAt instanceof Date
    );

    let casualTotal = 0;
    let monthlyTotal = 0;
    const byDayMap: Record<string, { casual: number; monthly: number }> = {};

    const transactions = paidPayments.map((p) => {
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

      const day = formatLocalDate(new Date(p.paidAt));
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
        where: {
          paidAt: { gte: thisPeriodStart, lte: thisPeriodEnd },
          status: 'SUCCESS',
        },
      }),
      prisma.payment.findMany({
        where: {
          paidAt: { gte: prevPeriodStart, lte: prevPeriodEnd },
          status: 'SUCCESS',
        },
      }),
      fullPrevStart && fullPrevEnd
        ? prisma.payment.findMany({
            where: {
              paidAt: { gte: fullPrevStart, lte: fullPrevEnd },
              status: 'SUCCESS',
            },
          })
        : Promise.resolve([]),
    ]);

    const calculateTotals = (payments: any[]) => {
      let total = 0;
      let casual = 0;
      let monthly = 0;
      for (const p of payments) {
        if (p.status !== 'SUCCESS' || !p.paidAt) {
          continue;
        }
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
    const now = new Date();
    const floors = await prisma.floor.findMany({
      orderBy: { floorCode: 'asc' },
      include: {
        slots: {
          orderBy: { code: 'asc' },
          select: { code: true, status: true },
        },
      },
    });

    const activeCheckins = await prisma.checkInRecord.findMany({
      where: {
        checkOutTime: null,
        status: 'PARKING',
      },
    });

    const activeBookings = await prisma.booking.findMany({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        expiresAt: { gt: now },
        checkInRecords: { none: {} },
      },
    });

    const totalCapacity = floors.reduce((sum, f) => sum + f.capacity, 0);
    let totalOccupied = 0;
    let totalReserved = 0;
    let totalAvailable = 0;

    const floorResults = floors.map((floor) => {
      const capacity = floor.capacity;
      const occupied = activeCheckins.filter((c) => c.floorId === floor.id).length;
      const reserved = activeBookings.filter((b) => b.floorId === floor.id).length;
      const available = capacity - occupied - reserved;

      totalOccupied += occupied;
      totalReserved += reserved;
      totalAvailable += available;

      // Keep slots display but show their status as is from DB (since monthly might use them, or they are default AVAILABLE)
      const slots = floor.slots ?? [];
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
