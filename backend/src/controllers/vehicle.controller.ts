import { Response } from 'express';
import { vehicleService } from '../services/vehicle.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';
import prisma from '../config/db';

export const vehicleController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const isStaffOrAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'STAFF' || req.user!.role === 'MANAGER';
    const ownerId = (isStaffOrAdmin && req.body.ownerId) ? req.body.ownerId : req.user!.id;

    if (ownerId === req.user!.id) {
      const currentUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
      let phoneNumber = currentUser?.phoneNumber;

      const inputPhone = req.body.phoneNumber || req.body.phone || req.body.ownerPhone;
      if (inputPhone && typeof inputPhone === 'string' && inputPhone.trim()) {
        const updatedUser = await prisma.user.update({
          where: { id: req.user!.id },
          data: { phoneNumber: inputPhone.trim() },
        });
        phoneNumber = updatedUser.phoneNumber;
      }

      if (!phoneNumber) {
        throw new AppError(400, 'Vui lòng cung cấp số điện thoại trước khi thêm xe.');
      }
    }

    const payload = {
      plateNumber: req.body.plateNumber,
      type: req.body.type,
      isMonthly: req.body.isMonthly,
      brand: req.body.brand,
      model: req.body.model,
      color: req.body.color,
      year: req.body.year,
      seats: req.body.seats,
      ownerId,
    };
    const vehicle = await vehicleService.create(payload);
    return res.status(201).json({ success: true, data: vehicle });
  }),
  
  getByPlate: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicle = await vehicleService.getByPlate(req.params.plateNumber);
    return res.status(200).json({ success: true, data: vehicle });
  }),

  getMyVehicles: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicles = await vehicleService.getByOwner(req.user!.id);
    return res.status(200).json({ success: true, data: vehicles });
  }),

  getDetail: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicle = await vehicleService.getDetail(req.params.id, req.user!.id);
    return res.status(200).json({ success: true, data: vehicle });
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const vehicle = await vehicleService.update(req.params.id, req.user!.id, req.body);
    return res.status(200).json({ success: true, data: vehicle });
  }),

  remove: asyncHandler(async (req: AuthRequest, res: Response) => {
    await vehicleService.remove(req.params.id, req.user!.id);
    return res.status(204).send();
  }),
};
