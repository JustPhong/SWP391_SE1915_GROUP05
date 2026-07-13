import { Response } from 'express';
import { bookingService } from '../services/booking.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const bookingController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('Not authenticated');
   
    const booking = await bookingService.create({
      plateNumber: req.body.plateNumber,
      expectedArrival: new Date(req.body.expectedArrival),
      createdById: req.user.id,
      ownerFullName: req.body.ownerFullName,
      ownerEmail: req.body.ownerEmail,
      ownerPhone: req.body.ownerPhone,
      type: req.body.type,
      brand: req.body.brand,
      model: req.body.model,
      color: req.body.color,
      year: req.body.year,
      seats: req.body.seats,
    });
    return res.status(201).json({ success: true, data: booking });
  }),     

  fulfill: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('Not authenticated');
    const result = await bookingService.fulfill({
      bookingId: req.params.id,
      staffId: req.user.id,
    });
    return res.status(200).json({ success: true, data: result[0] });
  }),

  markNoShow: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bookingId = req.params.id;
    const result = await bookingService.markNoShow(bookingId);
    return res.status(200).json({ success: true, data: result[0] });
  }),

  cancel: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bookingId = req.params.id;
    const result = await bookingService.cancel(bookingId);
    return res.status(200).json({ success: true, data: result[0] });
  }),

  getActiveBookings: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const bookings = await bookingService.getActiveBookings();
    return res.status(200).json({ success: true, data: bookings });
  }),

  getByVehicle: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bookings = await bookingService.getByVehicle(req.params.vehicleId);
    return res.status(200).json({ success: true, data: bookings });
  }),

  getAll: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const bookings = await bookingService.getAll();
    return res.status(200).json({ success: true, data: bookings });
  }),
};

