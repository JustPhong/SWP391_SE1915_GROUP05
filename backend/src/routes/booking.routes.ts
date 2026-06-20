import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller';
import { createBookingSchema, cancelBookingSchema } from '../dtos/booking.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// GET /api/bookings/active  — all active bookings
router.get('/active', bookingController.getActiveBookings);

// GET /api/bookings  — all bookings (staff/manager only)
router.get('/', authorize('STAFF', 'MANAGER', 'ADMIN'), bookingController.getAll);
     
// GET /api/bookings/vehicle/:vehicleId
router.get('/vehicle/:vehicleId', bookingController.getByVehicle);

// POST /api/bookings  — driver creates a booking
router.post('/', authorize('DRIVER'), createBookingSchema, validate, bookingController.create);

// POST /api/bookings/:id/cancel  — anyone cancels their booking
router.post('/:id/cancel', cancelBookingSchema, validate, bookingController.cancel);

// POST /api/bookings/:id/fulfill  — staff fulfills a booking
router.post('/:id/fulfill', authorize('STAFF', 'MANAGER', 'ADMIN'), bookingController.fulfill);

export default router;
