import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('MANAGER', 'ADMIN', 'STAFF'));

// ─── STAFF + MANAGER + ADMIN ───────────────────────────────────────────────

/**
 * @swagger
 * /reports/occupancy:
 *   get:
 *     summary: Get current occupancy overview
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current occupancy overview
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role
 */
router.get('/occupancy', reportController.getOccupancy);

/**
 * @swagger
 * /reports/summary:
 *   get:
 *     summary: Get lightweight summary (active check-ins, bookings, packages)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lightweight summary with activeCheckIns, activeBookings, activePackages
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role
 */
router.get('/summary', reportController.getSummary);

/**
 * @swagger
 * /reports/revenue:
 *   get:
 *     summary: Get detailed revenue report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Detailed revenue report (totalRevenue, byDay, byMethod, etc.)
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role
 */
router.get('/revenue', reportController.getRevenue);

// ─── MANAGER + ADMIN only ──────────────────────────────────────────────────

/**
 * @swagger
 * /reports/kpi-summary:
 *   get:
 *     summary: Get manager KPI summary (manager/admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Manager KPI summary (vehiclesParked, occupancyRate, monthlySubscribers, todayRevenue)
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires MANAGER or ADMIN)
 */
router.get('/kpi-summary', authorize('MANAGER', 'ADMIN'), requirePermission('report.overview'), reportController.getManagerSummary);

/**
 * @swagger
 * /reports/revenue-by-day:
 *   get:
 *     summary: Revenue per day (manager/admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         description: "Start date in YYYY-MM-DD format (default: 7 days ago)"
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         description: "End date in YYYY-MM-DD format (default: today)"
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       '200':
 *         description: Daily revenue data [{ date, amount }, ...]
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires MANAGER or ADMIN)
 */
router.get('/revenue-by-day', authorize('MANAGER', 'ADMIN'), reportController.getRevenueByDay);

/**
 * @swagger
 * /reports/vehicles-by-type:
 *   get:
 *     summary: Vehicle count by type (manager/admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Vehicle counts by type { car, motorbike }
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires MANAGER or ADMIN)
 */
router.get('/vehicles-by-type', authorize('MANAGER', 'ADMIN'), reportController.getVehiclesByType);

/**
 * @swagger
 * /reports/revenue-detail:
 *   get:
 *     summary: Revenue breakdown casual vs monthly (manager/admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         description: "Start date in YYYY-MM-DD format (default: 30 days ago)"
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         description: "End date in YYYY-MM-DD format (default: today)"
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       '200':
 *         description: Revenue breakdown { total, casualTotal, monthlyTotal, series, transactions }
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires MANAGER or ADMIN)
 */
router.get('/revenue-detail', authorize('MANAGER', 'ADMIN'), reportController.getRevenueDetail);

/**
 * @swagger
 * /reports/occupancy-detail:
 *   get:
 *     summary: Per-floor occupancy breakdown (manager/admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Per-floor occupancy { totalCapacity, totalOccupied, overallRate, floors }
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires MANAGER or ADMIN)
 */
router.get('/occupancy-detail', authorize('MANAGER', 'ADMIN'), reportController.getOccupancyDetail);

/**
 * @swagger
 * /reports/traffic:
 *   get:
 *     summary: Traffic in/out report (manager/admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         description: "Start date in YYYY-MM-DD format (default: 7 days ago)"
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         description: "End date in YYYY-MM-DD format (default: today)"
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       '200':
 *         description: Traffic report { totalIn, totalOut, currentlyParked, byVehicleType, daily, hourly, peakHour }
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires MANAGER or ADMIN)
 */
router.get('/traffic', authorize('MANAGER', 'ADMIN'), reportController.getTraffic);

export default router;