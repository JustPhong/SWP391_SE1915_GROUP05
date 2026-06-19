import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";
import { asyncHandler } from "../utils/helpers";
import { floorService } from "../services/floor.service";

/**
 * GET /floors
 */
export const getAllFloors = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await prisma.floor.findMany({
      orderBy: { id: "asc" },
    });
    res.json({ success: true, data });
  }
);

/**
 * GET /floors/:floorCode
 */
export const getSlotsByFloor = asyncHandler(
  async (req: Request, res: Response) => {
    const { floorCode } = req.params;
    const data = await floorService.getSlotsByFloor(floorCode);
    res.json({ success: true, data });
  }
);

/**
 * GET /floors/:floorCode/slots?status=AVAILABLE
 */
export const getSlotsByFloorAndStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { floorCode } = req.params;
    const status = req.query.status as string | undefined;
    const data = await floorService.getSlotsByFloorAndStatus(floorCode, status);
    res.json({ success: true, data });
  }
);

/**
 * POST /floors
 */
export const createFloor = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await floorService.createFloor(req.body);
    res.status(201).json({ success: true, data });
  }
);

/**
 * PUT /floors/:id
 */
export const updateFloor = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const data = await floorService.updateFloor(id, req.body);
    res.json({ success: true, data });
  }
);

/**
 * DELETE /floors/:id
 */
export const deleteFloor = asyncHandler(
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await floorService.removeFloor(id);
    res.json({ success: true, message: "Xóa tầng thành công" });
  }
);