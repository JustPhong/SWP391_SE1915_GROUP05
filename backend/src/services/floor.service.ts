import prisma from '../config/db';
import { AppError } from '../utils/helpers';

const BOOKING_ACTIVE = 'ACTIVE';
const SLOT_AVAILABLE = 'AVAILABLE';
const NO_SHOW_CUTOFF_MINUTES = 15;

export interface FloorWithSlots {
  id: number;
  floorCode: string;
  name: string;
  vehicleType: string;
  customerType: string;
  capacity: number;
  slots: {
    id: string;
    code: string;
    type: string;
    status: string;
    isFixed: boolean;
  }[];
}

export const floorService = {
  async getAllFloors(): Promise<FloorWithSlots[]> {
    const floors = await prisma.floor.findMany({
      orderBy: { id: 'asc' },
      include: {
        slots: {
          orderBy: { code: 'asc' },
          select: { id: true, code: true, type: true, status: true, isFixed: true },
        },
      },
    });
    return floors;
  },

  async getSlotsByFloor(floorCode: string): Promise<FloorWithSlots> {
    const floor = await prisma.floor.findUnique({
      where: { floorCode },
      include: {
        slots: {
          orderBy: { code: 'asc' },
          select: { id: true, code: true, type: true, status: true, isFixed: true },
        },
      },
    });
    if (!floor) throw new AppError(404, 'Floor not found');

    // Lazy no-show cleanup: mark stale ACTIVE bookings as NO_SHOW and free their slots
    await this.cleanupNoShowBookings();

    return floor;
  },

  async cleanupNoShowBookings(): Promise<number> {
    const cutoff = new Date(Date.now() - NO_SHOW_CUTOFF_MINUTES * 60 * 1000);
    const staleBookings = await prisma.booking.findMany({
      where: {
        status: BOOKING_ACTIVE,
        expectedArrival: { lt: cutoff },
      },
    });

    let cleaned = 0;
    for (const booking of staleBookings) {
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'NO_SHOW', depositStatus: 'FORFEITED' },
        }),
        prisma.parkingSlot.update({
          where: { id: booking.slotId },
          data: { status: SLOT_AVAILABLE },
        }),
      ]);
      cleaned++;
    }
    return cleaned;
  },
};
