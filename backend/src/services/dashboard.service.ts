import prisma from '../config/db';

interface FloorOccupancy {
  floorCode: string;
  name: string;
  occupied: number;
  capacity: number;
  percent: number;
}
   
interface RecentCheckin {
  plate: string;
  vehicleType: string;
  slotCode: string;
  checkInTime: string;
  parked: boolean;
}

export interface StaffDashboardData {
  vehiclesInLot: number;
  freeCar: number;
  freeMotorbike: number;
  totalSlots: number;
  checkedInToday: number;
  checkedOutToday: number;
  floors: FloorOccupancy[];
  recentCheckins: RecentCheckin[];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const dashboardService = {
  async getStaffDashboard(): Promise<StaffDashboardData> {
    const today = startOfToday();

    const [
      vehiclesInLot,
      freeCar,
      freeMotorbike,
      totalSlots,
      checkedInToday,
      checkedOutToday,
      floors,
      recentCheckins,
    ] = await Promise.all([
      // vehicles currently in lot
      prisma.checkInRecord.count({ where: { checkOutTime: null } }),

      // free car slots
      prisma.parkingSlot.count({
        where: { status: 'AVAILABLE', type: 'CAR' },
      }),

      // free motorbike slots
      prisma.parkingSlot.count({
        where: { status: 'AVAILABLE', type: 'MOTORBIKE' },
      }),

      // total slots
      prisma.parkingSlot.count(),

      // checked in today
      prisma.checkInRecord.count({
        where: { checkInTime: { gte: today } },
      }),

      // checked out today
      prisma.checkInRecord.count({
        where: { checkOutTime: { gte: today } },
      }),

      // floor occupancy: G, 1, 2, 3
      prisma.floor.findMany({
        orderBy: { id: 'asc' },
        include: {
          _count: { select: { slots: { where: { status: 'OCCUPIED' } } } },
        },
      }),

      // last 5 check-in records (newest first)
      prisma.checkInRecord.findMany({
        take: 5,
        orderBy: { checkInTime: 'desc' },
        include: {
          vehicle: { select: { plateNumber: true, type: true } },
          slot: { select: { code: true } },
        },
      }),
    ]);

    const floorData: FloorOccupancy[] = floors.map((f) => {
      const occupied = f._count.slots;
      return {
        floorCode: f.floorCode,
        name: f.name,
        occupied,
        capacity: f.capacity,
        percent: Math.round((occupied / f.capacity) * 100),
      };
    });

    const recentCheckinData: RecentCheckin[] = recentCheckins.map((r) => ({
      plate: r.vehicle.plateNumber,
      vehicleType: r.vehicle.type,
      slotCode: r.slot?.code ?? '',
      checkInTime: r.checkInTime.toISOString(),
      parked: r.checkOutTime === null,
    }));

    return {
      vehiclesInLot,
      freeCar,
      freeMotorbike,
      totalSlots,
      checkedInToday,
      checkedOutToday,
      floors: floorData,
      recentCheckins: recentCheckinData,
    };
  },
};
