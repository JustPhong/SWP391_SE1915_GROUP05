import { Response } from 'express';
import { bookingService } from '../services/booking.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';

export const bookingController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('Not authenticated');
   
    const plateNumber = req.body.plateNumber;
    if (!plateNumber || typeof plateNumber !== 'string' || plateNumber.trim() === '') {
      throw new AppError(400, 'Biển số xe không được để trống.');
    }

    const expectedArrivalStr = req.body.expectedArrival;
    if (!expectedArrivalStr) {
      throw new AppError(400, 'Thời gian đến dự kiến không được để trống.');
    }
    const expectedArrival = new Date(expectedArrivalStr);
    if (isNaN(expectedArrival.getTime())) {
      throw new AppError(400, 'Thời gian đến dự kiến không hợp lệ.');
    }

    let floorId: number | undefined = undefined;
    if (req.body.floorId !== undefined && req.body.floorId !== null && req.body.floorId !== '') {
      const parsed = Number(req.body.floorId);
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        throw new AppError(400, 'Khu vực đỗ xe (floorId) phải là số nguyên dương hợp lệ.');
      }
      floorId = parsed;
    }

    const vehicleType = req.body.type ? String(req.body.type).trim().toUpperCase() : undefined;
    if (vehicleType && vehicleType !== 'CAR' && vehicleType !== 'MOTORBIKE') {
      throw new AppError(400, 'Loại xe không hợp lệ. Chỉ chấp nhận CAR hoặc MOTORBIKE.');
    }

    const booking = await bookingService.create({
      plateNumber,
      expectedArrival,
      createdById: req.user.id,
      ownerFullName: req.body.ownerFullName,
      ownerEmail: req.body.ownerEmail,
      ownerPhone: req.body.ownerPhone,
      type: vehicleType as 'CAR' | 'MOTORBIKE' | undefined,
      brand: req.body.brand,
      model: req.body.model,
      color: req.body.color,
      year: req.body.year ? Number(req.body.year) : undefined,
      seats: req.body.seats ? Number(req.body.seats) : undefined,
      floorId,
    });
    return res.status(201).json({ success: true, data: booking });
  }),     

  fulfill: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new Error('Not authenticated');
    const [booking, checkInRecord] = await bookingService.fulfill({
      bookingId: req.params.id,
      staffId: req.user.id,
    });
    return res.status(200).json({
      success: true,
      data: {
        booking,
        checkInRecord,
      },
    });
  }),

  markNoShow: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bookingId = req.params.id;
    const result = await bookingService.markNoShow(bookingId);
    return res.status(200).json({ success: true, data: result });
  }),

  cancel: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bookingId = req.params.id;
    const result = await bookingService.cancel(bookingId);
    return res.status(200).json({ success: true, data: result });
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

