import { Response } from 'express';
import { reportService, getCurrentShiftTimeRange } from '../services/report.service';
import { checkInService } from '../services/checkin-checkout.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const reportController = {
  // ─── Occupancy (existing, unchanged) ──────────────────────────────────────

  getOccupancy: asyncHandler(async (req: AuthRequest, res: Response) => {
    const floorId = req.query.floorId ? parseInt(req.query.floorId as string) : undefined;
    const report = await reportService.getOccupancyReport({ floorId });
    return res.status(200).json({ success: true, data: report });
  }),
   
  // ─── Existing summary (STAFF + MANAGER + ADMIN via router-level authorize) ─

  getSummary: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [checkIns, bookings, packages] = await Promise.all([
      reportService.getActiveCheckInsCount(),
      reportService.getActiveBookingsCount(),
      reportService.getActivePackagesCount(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeCheckIns: checkIns,
        activeBookings: bookings,
        activePackages: packages,
      },
    });
  }),

  // ─── Existing revenue report (STAFF + MANAGER + ADMIN) ─────────────────────

  getCurrentShift: asyncHandler(async (req: AuthRequest, res: Response) => {
    const shiftInfo = getCurrentShiftTimeRange();
    return res.status(200).json({
      success: true,
      data: {
        shift: shiftInfo.shiftName,
        dateStr: shiftInfo.dateStr,
        start: shiftInfo.start.toISOString(),
        end: shiftInfo.end.toISOString()
      }
    });
  }),

  getShiftActivity: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }

    const userRole = req.user.role.toUpperCase();
    let start: Date;
    let end: Date;

    if (userRole === 'STAFF') {
      const currentShift = getCurrentShiftTimeRange();
      start = currentShift.start;
      end = currentShift.end;
    } else {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Các tham số startDate và endDate của ca trực là bắt buộc.'
        });
      }

      start = new Date(startDate as string);
      end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Tham số ngày bắt đầu hoặc ngày kết thúc không hợp lệ.'
        });
      }
    }

    const records = await checkInService.getHistoryRecords(undefined, 200, start, end);
    return res.status(200).json({ success: true, data: records });
  }),

  getRevenue: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }

    const userRole = req.user.role.toUpperCase();
    let start: Date;
    let end: Date;

    if (userRole === 'STAFF') {
      // Ignore user query params and resolve the current operational shift on the server
      const currentShift = getCurrentShiftTimeRange();
      start = currentShift.start;
      end = currentShift.end;
    } else {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Các tham số startDate và endDate của ca trực là bắt buộc.'
        });
      }

      start = new Date(startDate as string);
      end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Tham số ngày bắt đầu hoặc ngày kết thúc không hợp lệ.'
        });
      }
    }

    const report = await reportService.getRevenueReport({ startDate: start, endDate: end });
    return res.status(200).json({ success: true, data: report });
  }),

  // ─── NEW: Manager KPI summary (MANAGER + ADMIN only) ──────────────────────

  getManagerSummary: asyncHandler(async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let from: Date | undefined;
    let to: Date | undefined;

    if (req.query.from) {
      const d = new Date(req.query.from as string);
      if (!isNaN(d.getTime())) { from = d; from.setHours(0, 0, 0, 0); }
    }
    if (req.query.to) {
      const d = new Date(req.query.to as string);
      if (!isNaN(d.getTime())) { to = d; to.setHours(23, 59, 59, 999); }
    }

    const summary = await reportService.getManagerSummary(from, to);
    return res.status(200).json(summary);
  }),

  // ─── NEW: Revenue by day range (MANAGER + ADMIN only) ─────────────────────

  getRevenueByDay: asyncHandler(async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let from = new Date(now);
    let to = todayEnd;

    if (req.query.from) {
      const d = new Date(req.query.from as string);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        from = d;
      }
    } else {
      // default: last 7 days including today
      from = new Date(todayEnd);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    }

    if (req.query.to) {
      const d = new Date(req.query.to as string);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        to = d;
      }
    }

    const rows = await reportService.getRevenueByDay(from, to);
    return res.status(200).json(rows);
  }),

  // ─── NEW: Currently parked vehicles grouped by type (MANAGER + ADMIN only) ─

  getVehiclesByType: asyncHandler(async (req: AuthRequest, res: Response) => {
    let from: Date | undefined;
    let to: Date | undefined;

    if (req.query.from) {
      const d = new Date(req.query.from as string);
      if (!isNaN(d.getTime())) { from = d; from.setHours(0, 0, 0, 0); }
    }
    if (req.query.to) {
      const d = new Date(req.query.to as string);
      if (!isNaN(d.getTime())) { to = d; to.setHours(23, 59, 59, 999); }
    }

    const result = await reportService.getVehiclesByType(from, to);
    return res.status(200).json(result);
  }),

  // ─── NEW: Occupancy detail — per-floor slot breakdown (MANAGER + ADMIN only) ──

  getOccupancyDetail: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const data = await reportService.getOccupancyDetail();
    return res.status(200).json({ success: true, data });
  }),

  // ─── NEW: Traffic — entries/exits per day and hour (MANAGER + ADMIN only) ─────

  getTraffic: asyncHandler(async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let from = new Date(todayEnd);
    from.setDate(from.getDate() - 6); // last 7 days
    from.setHours(0, 0, 0, 0);

    let to = todayEnd;

    if (req.query.from) {
      const d = new Date(req.query.from as string);
      if (!isNaN(d.getTime())) { from = d; from.setHours(0, 0, 0, 0); }
    }
    if (req.query.to) {
      const d = new Date(req.query.to as string);
      if (!isNaN(d.getTime())) { to = d; to.setHours(23, 59, 59, 999); }
    }

    const data = await reportService.getTraffic(from, to);
    return res.status(200).json({ success: true, data });
  }),

  // ─── NEW: Revenue detail — casual vs monthly breakdown (MANAGER + ADMIN only) ──

  getRevenueDetail: asyncHandler(async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let from = new Date(now);
    let to = todayEnd;

    if (req.query.from) {
      const d = new Date(req.query.from as string);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        from = d;
      }
    } else {
      // default: last 30 days including today
      from = new Date(todayEnd);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
    }

    if (req.query.to) {
      const d = new Date(req.query.to as string);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        to = d;
      }
    }

    const data = await reportService.getRevenueDetail(from, to);
    return res.status(200).json({ success: true, data });
  }),

  getRevenueComparison: asyncHandler(async (req: AuthRequest, res: Response) => {
    let from: Date | undefined;
    let to: Date | undefined;
    const range = req.query.range as string | undefined;

    if (req.query.from) {
      from = new Date(req.query.from as string);
      from.setHours(0, 0, 0, 0);
    }
    if (req.query.to) {
      to = new Date(req.query.to as string);
      to.setHours(23, 59, 59, 999);
    }

    const data = await reportService.getRevenueComparison(from, to, range);
    return res.status(200).json({ success: true, data });
  }),

  getSessionLog: asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const from = req.query.from
    ? new Date(req.query.from as string)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const to = req.query.to
    ? new Date(req.query.to as string + 'T23:59:59')
    : now;
  const vehicleType = req.query.vehicleType as string | undefined;

  const data = await reportService.getSessionLog(from, to, vehicleType);
  return res.json({ success: true, data, total: data.length });
}),

exportSessionsCsv: asyncHandler(async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const from = req.query.from
    ? new Date(req.query.from as string)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const to = req.query.to
    ? new Date(req.query.to as string + 'T23:59:59')
    : now;
  const vehicleType = req.query.vehicleType as string | undefined;

  const csv = await reportService.exportSessionsCsv(from, to, vehicleType);
  const filename = `sessions_${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send('\uFEFF' + csv); // BOM cho Excel đọc được UTF-8
}),
};
