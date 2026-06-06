import prisma from '../config/db';

const SLOT_AVAILABLE = 'AVAILABLE';

export interface SlotSuggestion {
  slotId: string;
  code: string;
  floorId: number;
  type: string;
  distanceScore: number;
}

export type ZoneType = 'MONTHLY' | 'CASUAL';

export const slotSuggestionService = {
  async suggestSlot(vehicleType: string, zone: ZoneType): Promise<any | null> {
    const availableSlots = await prisma.parkingSlot.findMany({
      where: {
        status: SLOT_AVAILABLE,
        type: vehicleType,
        floor: { customerType: zone },
      },
      orderBy: [{ floorId: 'asc' }, { code: 'asc' }],
      take: 1,
    });

    if (availableSlots.length === 0) {
      return null;
    }

    return availableSlots[0];
  },

  async getAvailableSlots(vehicleType: string) {
    return prisma.parkingSlot.findMany({
      where: { status: SLOT_AVAILABLE, type: vehicleType },
      orderBy: [{ floorId: 'asc' }, { code: 'asc' }],
    });
  },

  async getAllSlotsGroupedByFloor() {
    const slots = await prisma.parkingSlot.findMany({
      orderBy: [{ floorId: 'asc' }, { code: 'asc' }],
    });

    const grouped: Record<number, typeof slots> = {};
    for (const slot of slots) {
      if (!grouped[slot.floorId]) grouped[slot.floorId] = [];
      grouped[slot.floorId].push(slot);
    }
    return grouped;
  },
};
