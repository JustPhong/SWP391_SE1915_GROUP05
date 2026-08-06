import prisma from "../config/db";
import { AppError } from "../utils/helpers";

const BOOKING_ACTIVE = "ACTIVE";
const SLOT_AVAILABLE = "AVAILABLE";
const NO_SHOW_CUTOFF_MINUTES = 30;

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
    tier: string;
  }[];
}

export interface FloorInput {
  floorCode: string;
  name: string;
  vehicleType: "CAR" | "MOTORBIKE";
  customerType: "MONTHLY" | "CASUAL";
  capacity: number;
}

export interface FloorCapacityMetrics {
  totalCapacity: number;
  activeParkingCount: number;
  physicalAvailableCapacity: number;
  activeBookingCount: number;
  receivableCapacity: number;
  occupancyPercent: number;
}

export async function getFloorCapacityMetrics(floorId: number, capacity: number): Promise<FloorCapacityMetrics> {
  const now = new Date();
  const [activeParkingCount, activeBookingCount] = await Promise.all([
    prisma.checkInRecord.count({
      where: {
        checkOutTime: null,
        OR: [
          { floorId: floorId },
          { slot: { floorId: floorId } }
        ]
      },
    }),
    prisma.booking.count({
      where: {
        floorId: floorId,
        status: 'ACTIVE',
        depositStatus: 'PAID',
        expiresAt: { gt: now },
        checkInRecords: { none: {} },
      },
    }),
  ]);

  const physicalAvailableCapacity = Math.max(0, capacity - activeParkingCount);
  const receivableCapacity = Math.max(0, capacity - activeParkingCount - activeBookingCount);
  const occupancyPercent = capacity > 0 ? Math.round((activeParkingCount / capacity) * 100) : 0;

  return {
    totalCapacity: capacity,
    activeParkingCount,
    physicalAvailableCapacity,
    activeBookingCount,
    receivableCapacity,
    occupancyPercent,
  };
}

export const floorService = {
  // Lấy tất cả tầng
  async getAllFloors(): Promise<any[]> {
    const floors = await prisma.floor.findMany({
      orderBy: { id: "asc" },
      include: {
        slots: {
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            isFixed: true,
            tier: true,
          },
        },
      },
    });

    const result: any[] = [];
    for (const floor of floors) {
      const metrics = await getFloorCapacityMetrics(floor.id, floor.capacity);
      result.push({
        ...floor,
        ...metrics,
      });
    }

    return result;
  },

  // Lấy 1 tầng theo floorCode
  async getSlotsByFloor(floorCode: string): Promise<any> {
    await floorService.cleanupNoShowBookings();

    const floor = await prisma.floor.findUnique({
      where: { floorCode },
      include: {
        slots: {
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            isFixed: true,
            tier: true,
          },
        },
      },
    });

    if (!floor) {
      throw new AppError(404, "Floor not found");
    }

    const metrics = await getFloorCapacityMetrics(floor.id, floor.capacity);

    return {
      ...floor,
      ...metrics,
    };
  },

  // Lấy slot theo tầng và trạng thái — kèm thông tin xe đang đỗ
  async getSlotsByFloorAndStatus(floorCode: string, status?: string) {
    await floorService.cleanupNoShowBookings();

    const floor = await prisma.floor.findUnique({
      where: { floorCode },
    });

    if (!floor) {
      throw new AppError(404, "Floor not found");
    }

    const slots = await prisma.parkingSlot.findMany({
      where: {
        floorId: floor.id,
        ...(status ? { status } : {}),
      },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        isFixed: true,
        tier: true,
        assignedVehicleId: true,
        checkInRecords: {
          where: { status: "PARKING" },
          take: 1,
          select: {
            checkInTime: true,
            isMonthly: true,
            vehicle: {
              select: {
                plateNumber: true,
                type: true,
              },
            },
          },
        },
      },
    });

    return {
      floorId: floor.id,
      floorCode: floor.floorCode,
      name: floor.name,
      vehicleType: floor.vehicleType,
      customerType: floor.customerType,
      slots: slots.map((slot) => {
        const session = slot.checkInRecords[0] ?? null;
        const { checkInRecords, ...slotBase } = slot;
        return {
          ...slotBase,
          vehicle: session
            ? {
                plateNumber: session.vehicle.plateNumber,
                vehicleType: session.vehicle.type,
                entryTime: session.checkInTime,
                isMonthly: session.isMonthly,
              }
            : null,
        };
      }),
    };
  },

  // Tạo tầng
  async createFloor(input: FloorInput): Promise<FloorWithSlots> {
    const existed = await prisma.floor.findUnique({
      where: { floorCode: input.floorCode },
    });

    if (existed) {
      throw new AppError(409, "Mã tầng đã tồn tại");
    }

    return prisma.floor.create({
      data: input,
      include: {
        slots: {
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            isFixed: true,
            tier: true,
          },
        },
      },
    });
  },

  // Cập nhật tầng
  async updateFloor(
    id: number,
    input: Partial<FloorInput>
  ): Promise<FloorWithSlots> {
    const floor = await prisma.floor.findUnique({ where: { id } });

    if (!floor) {
      throw new AppError(404, "Không tìm thấy tầng");
    }

    if (input.floorCode) {
      const duplicated = await prisma.floor.findFirst({
        where: { floorCode: input.floorCode, NOT: { id } },
      });
      if (duplicated) {
        throw new AppError(409, "Mã tầng đã tồn tại");
      }
    }

    return prisma.floor.update({
      where: { id },
      data: input,
      include: {
        slots: {
          orderBy: { code: "asc" },
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            isFixed: true,
            tier: true,
          },
        },
      },
    });
  },

  // Xóa tầng
  async removeFloor(id: number): Promise<void> {
    const floor = await prisma.floor.findUnique({
      where: { id },
      include: { slots: true },
    });

    if (!floor) {
      throw new AppError(404, "Không tìm thấy tầng");
    }

    if (floor.slots.length > 0) {
      throw new AppError(400, "Tầng còn slot, không thể xóa");
    }

    await prisma.floor.delete({ where: { id } });
  },

  // BR-BK-03: Dọn booking quá 30 phút chưa check-in
  async cleanupNoShowBookings(): Promise<number> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - NO_SHOW_CUTOFF_MINUTES * 60 * 1000);

    const pendingCount = await prisma.booking.count({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        checkInRecords: { none: {} }
      }
    });

    const expiredCount = await prisma.booking.count({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        checkInRecords: { none: {} },
        expectedArrival: { lte: cutoff }
      }
    });

    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'ACTIVE',
        depositStatus: 'PAID',
        checkInRecords: { none: {} },
        expectedArrival: { lte: cutoff }
      },
      include: {
        vehicle: { select: { plateNumber: true } },
        floor:   { select: { name: true } },
      },
    });

    let updatedCount = 0;

    for (const booking of expiredBookings) {
      try {
        await prisma.$transaction(async (tx) => {
          const result = await tx.booking.updateMany({
            where: {
              id: booking.id,
              status: 'ACTIVE',
              depositStatus: 'PAID',
              checkInRecords: { none: {} },
              expectedArrival: { lte: cutoff }
            },
            data: {
              status: 'NO_SHOW',
              depositStatus: 'FORFEITED'
            }
          });

          if (result.count === 1) {
            await tx.auditLog.create({
              data: {
                actorId:     null,
                actorName:   "System",
                actorRole:   "SYSTEM",
                action:      "booking.no_show",
                targetType:  "Booking",
                targetId:    String(booking.id),
                description: `Tự động hủy booking xe ${booking.vehicle.plateNumber} tại tầng ${booking.floor.name} — quá ${NO_SHOW_CUTOFF_MINUTES} phút không vào bãi, mất cọc`,
                metadata:    JSON.stringify({
                  bookingId:        booking.id,
                  plate:            booking.vehicle.plateNumber,
                  floorName:        booking.floor.name,
                  expectedArrival:  booking.expectedArrival,
                  depositForfeited: true,
                }),
              },
            });
            updatedCount++;
          }
        });
      } catch (updateErr) {
        console.error(`[NoShowJob] Failed to update booking ${booking.id}:`, updateErr);
      }
    }

    console.log(`[NoShowJob] Run at ${now.toISOString()}`);
    console.log(`[NoShowJob] Pending=${pendingCount} Expired=${expiredCount} Updated=${updatedCount}`);

    return updatedCount;
  },
};