import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('MANAGER', 'ADMIN', 'STAFF'));

// ─── STAFF + MANAGER + ADMIN ───────────────────────────────────────────────

// GET /api/reports/occupancy
router.get('/occupancy', reportController.getOccupancy);

// GET /api/reports/summary   (existing lightweight summary: activeCheckIns, activeBookings, activePackages)
router.get('/summary', reportController.getSummary);

// GET /api/reports/revenue   (existing detailed report: totalRevenue, byDay, byMethod, etc.)
router.get('/revenue', reportController.getRevenue);

// ─── MANAGER + ADMIN only ──────────────────────────────────────────────────

// GET /api/reports/kpi-summary
//   { vehiclesParked, occupancyRate, monthlySubscribers, todayRevenue }
router.get('/kpi-summary', authorize('MANAGER', 'ADMIN'), requirePermission('report.overview'), reportController.getManagerSummary);

// GET /api/reports/revenue-by-day?from=YYYY-MM-DD&to=YYYY-MM-DD
//   [{ date, amount }, ...] — default last 7 days
router.get('/revenue-by-day', authorize('MANAGER', 'ADMIN'), reportController.getRevenueByDay);

// GET /api/reports/vehicles-by-type
//   { car, motorbike }
router.get('/vehicles-by-type', authorize('MANAGER', 'ADMIN'), reportController.getVehiclesByType);

// GET /api/reports/revenue-detail?from=YYYY-MM-DD&to=YYYY-MM-DD
//   { total, casualTotal, monthlyTotal, series, transactions } — default last 30 days
router.get('/revenue-detail', authorize('MANAGER', 'ADMIN'), reportController.getRevenueDetail);

// GET /api/reports/occupancy-detail
//   { totalCapacity, totalOccupied, overallRate, floors } — per-floor slot breakdown
router.get('/occupancy-detail', authorize('MANAGER', 'ADMIN'), reportController.getOccupancyDetail);

// GET /api/reports/traffic?from=YYYY-MM-DD&to=YYYY-MM-DD
//   { totalIn, totalOut, currentlyParked, byVehicleType, daily, hourly, peakHour }
//   default range = last 7 days
router.get('/traffic', authorize('MANAGER', 'ADMIN'), reportController.getTraffic);

export default router;
