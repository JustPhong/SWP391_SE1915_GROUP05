import { Response } from 'express';
import prisma from '../config/db';
import { asyncHandler } from '../utils/helpers';

type VehicleBucket = { available: number; total: number };
type ZoneBucket = { car: VehicleBucket; motorbike: VehicleBucket };
type AvailabilityData = {
  casual: ZoneBucket;
  monthly: ZoneBucket;
  total: { available: number; capacity: number };
};

/**
 * GET /api/public/availability
 * No auth required — used by the landing-page StatusStrip.
 *
 * Counts AVAILABLE slots grouped by (floor.customerType, floor.vehicleType).
 * Each zone/vehicle bucket reports both:
 *   - available: slots whose status === 'AVAILABLE'
 *   - total:     ALL slots regardless of status (slot count, not Floor.capacity,
 *                so it reflects the real rows currently in the DB).
 * Grand totals are kept as before (available across all zones, capacity across
 * all slots).
 */
export const publicController = {
  getAvailability: asyncHandler(async (_req, res: Response) => {
    const allRows = await prisma.parkingSlot.findMany({
      select: {
        status: true,
        floorId: true,
        floor: {
          select: {
            id: true,
            vehicleType: true,
            customerType: true,
          },
        },
      },
    });

    const now = new Date();
    const activeBookings = await prisma.booking.findMany({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        expiresAt: { gt: now },
        checkInRecords: { none: {} },
      },
      select: {
        floorId: true,
      },
    });

    const activeBookingsPerFloor: Record<number, number> = {};
    for (const b of activeBookings) {
      activeBookingsPerFloor[b.floorId] = (activeBookingsPerFloor[b.floorId] || 0) + 1;
    }

    const data: AvailabilityData = {
      casual: {
        car: { available: 0, total: 0 },
        motorbike: { available: 0, total: 0 },
      },
      monthly: {
        car: { available: 0, total: 0 },
        motorbike: { available: 0, total: 0 },
      },
      total: { available: 0, capacity: 0 },
    };

    const floorsMap: Record<number, { customerType: string; vehicleType: string; slots: { status: string }[] }> = {};
    for (const row of allRows) {
      if (!floorsMap[row.floorId]) {
        floorsMap[row.floorId] = {
          customerType: row.floor.customerType,
          vehicleType: row.floor.vehicleType,
          slots: [],
        };
      }
      floorsMap[row.floorId].slots.push(row);
    }

    for (const [floorIdStr, floorInfo] of Object.entries(floorsMap)) {
      const floorId = Number(floorIdStr);
      const ct = floorInfo.customerType;
      const vt = floorInfo.vehicleType;
      if (ct !== 'CASUAL' && ct !== 'MONTHLY') continue;
      if (vt !== 'CAR' && vt !== 'MOTORBIKE') continue;

      const physicalAvailable = floorInfo.slots.filter(s => s.status === 'AVAILABLE').length;
      const total = floorInfo.slots.length;
      const activeBookingsCount = activeBookingsPerFloor[floorId] || 0;
      const receivable = Math.max(0, physicalAvailable - activeBookingsCount);

      const zone = data[ct === 'CASUAL' ? 'casual' : 'monthly'];
      const bucket = zone[vt === 'CAR' ? 'car' : 'motorbike'];

      bucket.total += total;
      data.total.capacity += total;

      bucket.available += receivable;
      data.total.available += receivable;
    }

    return res.status(200).json({
      success: true,
      data,
    });
  }),
};
