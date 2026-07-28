import prisma from '../config/db';
import { getFloorCapacityMetrics } from './floor.service';

export interface StaffDashboardFloorSummary {
  floorId: number;
  floorCode: string;
  floorName: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  customerType: 'CASUAL' | 'MONTHLY';
  totalCapacity: number;
  activeParkingCount: number;
  physicalAvailableCapacity: number;
  activeBookingCount: number;
  receivableCapacity: number;
  occupancyPercent: number;
}

export interface StaffRecentActivity {
  id: string;
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  customerType: 'CASUAL' | 'MONTHLY';
  floorName: string;
  time: string;
  status: 'PARKING' | 'COMPLETED';
}

export interface StaffDashboardSummary {
  totalCapacity: number;
  activeParkingCount: number;
  physicalAvailableCapacity: number;
  activeBookingCount: number;
  receivableCapacity: number;
  shiftCheckInCount: number;
  shiftCheckOutCount: number;
  floors: StaffDashboardFloorSummary[];
  recentActivities: StaffRecentActivity[];
}

function getCurrentShiftTimeRange(): { start: Date; end: Date } {
  const now = new Date();
  const currentHour = now.getHours();
  const start = new Date(now);
  const end = new Date(now);

  if (currentHour >= 6 && currentHour < 14) {
    // Shift 1: 06:00 - 14:00
    start.setHours(6, 0, 0, 0);
    end.setHours(14, 0, 0, 0);
  } else if (currentHour >= 14 && currentHour < 22) {
    // Shift 2: 14:00 - 22:00
    start.setHours(14, 0, 0, 0);
    end.setHours(22, 0, 0, 0);
  } else {
    // Shift 3: 22:00 - 06:00
    if (currentHour >= 22) {
      start.setHours(22, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      end.setHours(6, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - 1);
      start.setHours(22, 0, 0, 0);
      end.setHours(6, 0, 0, 0);
    }
  }
  return { start, end };
}

export const dashboardService = {
  async getStaffDashboard(): Promise<StaffDashboardSummary> {
    const { start: shiftStart, end: shiftEnd } = getCurrentShiftTimeRange();
    const now = new Date();

    const [
      floors,
      shiftCheckInCount,
      shiftCheckOutCount,
      recentCheckInRecords
    ] = await Promise.all([
      // 1. Fetch all operational floors
      prisma.floor.findMany({
        orderBy: { id: 'asc' },
      }),
      // 2. Shift check-ins
      prisma.checkInRecord.count({
        where: {
          checkInTime: { gte: shiftStart, lte: shiftEnd }
        }
      }),
      // 3. Shift check-outs
      prisma.checkInRecord.count({
        where: {
          checkOutTime: { gte: shiftStart, lte: shiftEnd }
        }
      }),
      // 4. Recent activities
      prisma.checkInRecord.findMany({
        take: 10,
        orderBy: { checkInTime: 'desc' },
        include: {
          vehicle: { select: { plateNumber: true, type: true } },
          floor: { select: { name: true } },
          slot: {
            select: {
              code: true,
              floor: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      })
    ]);

    // 5. Gather per-floor statistics
    const floorSummaries: StaffDashboardFloorSummary[] = await Promise.all(
      floors.map(async (f) => {
        const metrics = await getFloorCapacityMetrics(f.id, f.capacity);

        return {
          floorId: f.id,
          floorCode: f.floorCode,
          floorName: f.name,
          vehicleType: f.vehicleType as 'CAR' | 'MOTORBIKE',
          customerType: f.customerType as 'CASUAL' | 'MONTHLY',
          ...metrics,
        };
      })
    );

    // 6. Aggregate totals across the dashboard scope (all floors)
    let totalCapacity = 0;
    let activeParkingCount = 0;
    let physicalAvailableCapacity = 0;
    let activeBookingCount = 0;
    let receivableCapacity = 0;

    for (const fs of floorSummaries) {
      totalCapacity += fs.totalCapacity;
      activeParkingCount += fs.activeParkingCount;
      physicalAvailableCapacity += fs.physicalAvailableCapacity;
      activeBookingCount += fs.activeBookingCount;
      receivableCapacity += fs.receivableCapacity;
    }

    // 7. Format recent activities sorted by activity time descending
    const recentActivities: StaffRecentActivity[] = recentCheckInRecords
      .map((r) => {
        const time = r.checkOutTime ?? r.checkInTime;
        const status: 'PARKING' | 'COMPLETED' = r.checkOutTime ? 'COMPLETED' : 'PARKING';
        const floorName = r.floor?.name ?? r.slot?.floor?.name ?? 'Chưa xác định';
        const vehicleType: 'CAR' | 'MOTORBIKE' = r.vehicle.type === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR';
        const customerType: StaffRecentActivity['customerType'] = r.isMonthly ? 'MONTHLY' : 'CASUAL';

        const activity: StaffRecentActivity = {
          id: r.id,
          plate: r.vehicle.plateNumber,
          vehicleType,
          customerType,
          floorName,
          time: time.toISOString(),
          status,
        };
        return activity;
      })
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return {
      totalCapacity,
      activeParkingCount,
      physicalAvailableCapacity,
      activeBookingCount,
      receivableCapacity,
      shiftCheckInCount,
      shiftCheckOutCount,
      floors: floorSummaries,
      recentActivities
    };
  }
};
