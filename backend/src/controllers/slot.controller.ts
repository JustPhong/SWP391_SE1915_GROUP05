import { Response } from 'express';
import prisma from '../config/db';
import { asyncHandler } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth.middleware';

export const slotController = {
  getAvailable: asyncHandler(async (req: AuthRequest, res: Response) => {
    const type = req.query.vehicleType as 'MOTORBIKE' | 'CAR' | undefined;
    const customerType = req.query.customerType as 'MONTHLY' | 'CASUAL' | undefined;

    if (type && customerType) {
      // Use the dedicated checkin service logic
      const { checkinService } = await import('../services/checkin.service');
      const slots = await checkinService.getAvailableSlots(type, customerType);
      return res.status(200).json({ success: true, data: slots });
    }

    // Fallback: original behaviour (vehicleType filter only)
    const where: Record<string, unknown> = { status: 'AVAILABLE' };
    if (type) where.type = type;

    const slots = await prisma.parkingSlot.findMany({
      where,
      orderBy: [{ floorId: 'asc' }, { code: 'asc' }],
    });
    return res.status(200).json({ success: true, data: slots });
  }),

  // GET /api/slots/all — all slots with floor info, grouped on client
  getAll: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const slots = await prisma.parkingSlot.findMany({
      include: { floor: true },
      orderBy: [{ floor: { floorCode: 'asc' } }, { code: 'asc' }],
    });
    return res.status(200).json({ success: true, data: slots });
  }),
};
