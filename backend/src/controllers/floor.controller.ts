import { Response } from 'express';
import { floorService } from '../services/floor.service';
import { asyncHandler } from '../utils/helpers';
import type { AuthRequest } from '../middleware/auth.middleware';

export const floorController = {
  getAllFloors: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const floors = await floorService.getAllFloors();
    return res.status(200).json({ success: true, data: floors });
  }),

  getSlotsByFloor: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { floorCode } = req.params;
    const floor = await floorService.getSlotsByFloor(floorCode);
    return res.status(200).json({ success: true, data: floor });
  }),
};
