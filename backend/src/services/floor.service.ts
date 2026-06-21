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
  }[];
}

export interface FloorInput {
  floorCode: string;
  name: string;
  vehicleType: "CAR" | "MOTORBIKE";
  customerType: "MONTHLY" | "CASUAL";
  capacity: number;
}

export const floorService = {
  // Lấy tất cả tầng
  async getAllFloors(): Promise<FloorWithSlots[]> {
    return prisma.floor.findMany({
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
          },
        },
      },
    });
  },

  // Lấy 1 tầng theo floorCode
  async getSlotsByFloor(floorCode: string): Promise<FloorWithSlots> {
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
          },
        },
      },
    });

    if (!floor) {
      throw new AppError(404, "Floor not found");
    }

    return floor;
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
      assignedVehicleId: true,
      // ← JOIN session đang đỗ
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

  // Format: gộp vehicle lên level slot
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
    const floor = await prisma.floor.findUnique({
      where: { id },
    });

    if (!floor) {
      throw new AppError(404, "Không tìm thấy tầng");
    }

    if (input.floorCode) {
      const duplicated = await prisma.floor.findFirst({
        where: {
          floorCode: input.floorCode,
          NOT: { id },
        },
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
          },
        },
      },
    });
  },

  // Xóa tầng
  async removeFloor(id: number): Promise<void> {
    const floor = await prisma.floor.findUnique({
      where: { id },
      include: {
        slots: true,
      },
    });

    if (!floor) {
      throw new AppError(404, "Không tìm thấy tầng");
    }

    if (floor.slots.length > 0) {
      throw new AppError(400, "Tầng còn slot, không thể xóa");
    }

    await prisma.floor.delete({
      where: { id },
    });
  },

  // Dọn booking quá hạn
  async cleanupNoShowBookings(): Promise<number> {
    const cutoff = new Date(
      Date.now() - NO_SHOW_CUTOFF_MINUTES * 60 * 1000
    );

    const bookings = await prisma.booking.findMany({
      where: {
        status: BOOKING_ACTIVE,
        expectedArrival: {
          lt: cutoff,
        },
      },
    });

    for (const booking of bookings) {
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
    }

  
    return bookings.length;
  },
};