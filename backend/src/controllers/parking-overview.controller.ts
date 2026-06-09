import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const parkingOverviewController = {
  getOverview: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const [floors, occupiedCount, totalSlots] = await Promise.all([
      prisma.floor.findMany({ orderBy: { floorCode: 'asc' } }),
      prisma.parkingSlot.count({
        where: { status: { in: ['OCCUPIED', 'RESERVED'] } },
      }),
      prisma.parkingSlot.count(),
    ]);

    const totalFloors = floors.length;
    const totalAvailable = totalSlots - occupiedCount;
    const overallOccupancy = totalSlots > 0
      ? Math.round((occupiedCount / totalSlots) * 100)
      : 0;

    // Per-floor breakdown — batch count per floor
    const slotCounts = await prisma.parkingSlot.groupBy({
      by: ['floorId', 'status'],
      _count: { id: true },
    });

    const countMap: Record<number, Record<string, number>> = {};
    for (const row of slotCounts) {
      if (!countMap[row.floorId]) countMap[row.floorId] = {};
      countMap[row.floorId][row.status] = row._count.id;
    }

    const perFloor = floors.map((floor) => {
      const occ = (countMap[floor.id]?.OCCUPIED ?? 0) + (countMap[floor.id]?.RESERVED ?? 0);
      const total = floor.capacity;
      const avail = total - occ;
      return {
        floorCode: floor.floorCode,
        floorName: floor.name,
        customerType: floor.customerType,
        vehicleType: floor.vehicleType,
        totalSlots: total,
        occupied: occ,
        available: avail,
        occupancyPercent: total > 0 ? Math.round((occ / total) * 100) : 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        building: {
          totalFloors,
          totalSlots,
          occupied: occupiedCount,
          available: totalAvailable,
          overallOccupancy,
        },
        floors: perFloor,
      },
    });
  }),
};
