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
    // Pull just the (customerType, vehicleType) projection for ALL slots.
    // We bucket in-memory — cheap for the slot table sizes this app handles
    // and avoids 4 separate Prisma aggregates.
    const allRows = await prisma.parkingSlot.findMany({
      select: {
        status: true,
        floor: {
          select: {
            vehicleType: true,
            customerType: true,
          },
        },
      },
    });

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

    for (const row of allRows) {
      const ct = row.floor.customerType;
      const vt = row.floor.vehicleType;
      if (ct !== 'CASUAL' && ct !== 'MONTHLY') continue;
      if (vt !== 'CAR' && vt !== 'MOTORBIKE') continue;

      const zone = data[ct === 'CASUAL' ? 'casual' : 'monthly'];
      const bucket = zone[vt === 'CAR' ? 'car' : 'motorbike'];
      bucket.total += 1;
      data.total.capacity += 1;
      if (row.status === 'AVAILABLE') {
        bucket.available += 1;
        data.total.available += 1;
      }
    }

    return res.status(200).json({
      success: true,
      data,
    });
  }),
};
