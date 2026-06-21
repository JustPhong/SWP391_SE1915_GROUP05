import prisma from '../config/db';
import { AppError } from '../utils/helpers';

export interface CreateVehicleInput {
  plateNumber: string;
  type: string;
  ownerId: string;
  isMonthly?: boolean;
}
    
async function loadOwnedVehicleOrThrow(vehicleId: string, userId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    throw new AppError(404, 'Không tìm thấy xe');
  }
  if (vehicle.ownerId !== userId) {
    throw new AppError(403, 'Bạn không có quyền với xe này');
  }
  return vehicle;
}

export const vehicleService = {
  async create(input: CreateVehicleInput) {
    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber: input.plateNumber },
    });
    if (existing) {
      throw new AppError(409, 'Vehicle with this plate number already exists');
    }

    return prisma.vehicle.create({ data: input });
  },

  async getByPlate(plateNumber: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber },
      include: { owner: true },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    return vehicle;
  },

  async getById(id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { owner: true },
    });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    return vehicle;
  },

  async getByOwner(ownerId: string) {
    return prisma.vehicle.findMany({ where: { ownerId } });
  },

  async update(id: string, userId: string, data: Partial<CreateVehicleInput>) {
    const vehicle = await loadOwnedVehicleOrThrow(id, userId);

    if (data.plateNumber && data.plateNumber !== vehicle.plateNumber) {
      const existing = await prisma.vehicle.findUnique({
        where: { plateNumber: data.plateNumber },
      });
      if (existing) throw new AppError(409, 'Plate number already in use');
    }

    return prisma.vehicle.update({ where: { id }, data });
  },

  async remove(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id } });
      if (!vehicle) {
        throw new AppError(404, 'Không tìm thấy xe');
      }
      if (vehicle.ownerId !== userId) {
        throw new AppError(403, 'Bạn không có quyền với xe này');
      }

      const [activePackage, activeBooking, checkInCount, assignedSlot] = await Promise.all([
        tx.monthlyPackage.findFirst({
          where: { vehicleId: id, status: 'ACTIVE' },
          select: { id: true },
        }),
        tx.booking.findFirst({
          where: { vehicleId: id, status: 'ACTIVE' },
          select: { id: true },
        }),
        tx.checkInRecord.count({ where: { vehicleId: id } }),
        tx.parkingSlot.findFirst({
          where: { assignedVehicleId: id },
          select: { id: true },
        }),
      ]);

      if (activePackage) {
        throw new AppError(409, 'Không thể xoá xe đang có gói tháng. Vui lòng đợi gói hết hạn.');
      }
      if (activeBooking) {
        throw new AppError(409, 'Không thể xoá xe đang có lượt đặt chỗ.');
      }
      if (checkInCount > 0) {
        throw new AppError(409, 'Không thể xoá xe đã có lịch sử gửi xe.');
      }
      if (assignedSlot) {
        throw new AppError(409, 'Không thể xoá xe đang được gán chỗ đỗ.');
      }

      try {
        await tx.vehicle.delete({ where: { id } });
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 'P2003') {
          throw new AppError(409, 'Không thể xoá xe này vì đang có dữ liệu liên quan.');
        }
        throw err;
      }
    });
  },
};
