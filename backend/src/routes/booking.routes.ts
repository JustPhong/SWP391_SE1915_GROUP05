import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller';
import { createBookingSchema, cancelBookingSchema } from '../dtos/booking.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /bookings/active:
 *   get:
 *     summary: List all active bookings
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of active bookings
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 */
router.get('/active', bookingController.getActiveBookings);

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: List all bookings (staff/manager/admin only)
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of all bookings
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires STAFF, MANAGER, or ADMIN)
 */
router.get('/', authorize('STAFF', 'MANAGER', 'ADMIN'), bookingController.getAll);

/**
 * @swagger
 * /bookings/vehicle/{vehicleId}:
 *   get:
 *     summary: Get bookings for a vehicle
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the vehicle
 *     responses:
 *       '200':
 *         description: Bookings for the vehicle
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '404':
 *         description: No bookings found for this vehicle
 */
router.get('/vehicle/:vehicleId', bookingController.getByVehicle);

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a booking (driver only)
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plateNumber
 *               - slotId
 *               - expectedArrival
 *             properties:
 *               plateNumber:
 *                 type: string
 *                 description: License plate of the vehicle
 *                 example: "30A-123.45"
 *               slotId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the parking slot to book
 *               expectedArrival:
 *                 type: string
 *                 format: date-time
 *                 description: Expected arrival time (ISO 8601)
 *     responses:
 *       '201':
 *         description: Booking created successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires DRIVER)
 */
router.post('/', authorize('DRIVER'), createBookingSchema, validate, bookingController.create);

/**
 * @swagger
 * /bookings/{id}/cancel:
 *   post:
 *     summary: Cancel a booking
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the booking to cancel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *             properties:
 *               bookingId:
 *                 type: integer
 *                 description: Numeric booking ID (must be an integer)
 *     responses:
 *       '200':
 *         description: Booking cancelled successfully
 *       '400':
 *         description: Bad request
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '404':
 *         description: Booking not found
 */
router.post('/:id/cancel', cancelBookingSchema, validate, bookingController.cancel);

/**
 * @swagger
 * /bookings/{id}/fulfill:
 *   post:
 *     summary: Fulfill a booking (staff/manager/admin only)
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the booking to fulfill
 *     responses:
 *       '200':
 *         description: Booking fulfilled successfully
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires STAFF, MANAGER, or ADMIN)
 *       '404':
 *         description: Booking not found
 */
router.post('/:id/fulfill', authorize('STAFF', 'MANAGER', 'ADMIN'), bookingController.fulfill);

export default router;
 