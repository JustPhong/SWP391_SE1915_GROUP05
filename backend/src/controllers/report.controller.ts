import { Response } from 'express';
import { reportService } from '../services/report.service';
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

  getRevenue: asyncHandler(async (req: AuthRequest, res: Response) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const report = await reportService.getRevenueReport({ startDate, endDate });
    return res.status(200).json({ success: true, data: report });
  }),

  // ─── NEW: Manager KPI summary (MANAGER + ADMIN only) ──────────────────────

  getManagerSummary: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const summary = await reportService.getManagerSummary();
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

  getVehiclesByType: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const result = await reportService.getVehiclesByType();
    return res.status(200).json(result);
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
};
