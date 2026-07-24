import prisma from '../config/db';
import { AppError } from '../utils/helpers';

export interface CreateVehicleInput {
  plateNumber: string;
  type: string;
  ownerId: string;
  isMonthly?: boolean;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
  ownerFullName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
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

    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
    });
    if (!owner) {
      throw new AppError(404, 'Không tìm thấy thông tin chủ xe');
    }

    const data = {
      plateNumber: input.plateNumber,
      type: input.type,
      ownerId: input.ownerId,
      isMonthly: input.isMonthly ?? false,
      brand: input.brand ?? undefined,
      model: input.model ?? undefined,
      color: input.color ?? undefined,
      year: input.year ?? undefined,
      seats: input.seats ?? undefined,
      ownerFullName: owner.fullName,
      ownerEmail: owner.email.toLowerCase(),
      ownerPhone: owner.phoneNumber ?? null,
    };
    return prisma.vehicle.create({ data });
  },

  async getByPlate(plateNumber: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        monthlyPackage: {
          select: {
            id: true,
            status: true,
            expiryDate: true,
          },
        },
        checkInRecords: {
          orderBy: {
            checkInTime: 'desc',
          },
          take: 1,
          select: {
            checkInTime: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new AppError(404, 'Không tìm thấy xe');
    }

    return {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      type: vehicle.type,
      brand: vehicle.brand,
      model: vehicle.model,
      color: vehicle.color,

      owner: vehicle.owner,

      isMonthly: vehicle.isMonthly || (vehicle.monthlyPackage?.status === 'ACTIVE'),

      monthlyPackage: vehicle.monthlyPackage,

      lastParking:
        vehicle.checkInRecords.length > 0 ? vehicle.checkInRecords[0].checkInTime : null,
    };
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
    return prisma.vehicle.findMany({
      where: { ownerId },
      select: {
        id: true,
        plateNumber: true,
        type: true,
        brand: true,
        model: true,
        color: true,
        year: true,
        seats: true,
        isMonthly: true,
        ownerFullName: true,
        ownerEmail: true,
        ownerPhone: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        monthlyPackage: {
          select: {
            id: true,
            status: true,
            startDate: true,
            expiryDate: true,
            price: true,
            planName: true,
            autoRenew: true,
          },
        },
      },
    });
  },

  async getDetail(vehicleId: string, userId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            floor: true,
          },
        },
        monthlyPackage: {
          select: {
            id: true,
            status: true,
            startDate: true,
            expiryDate: true,
            price: true,
            planName: true,
            autoRenew: true,
            floor: true,
          },
        },
        checkInRecords: {
          orderBy: { checkInTime: 'desc' },
          take: 5,
          include: {
            slot: { include: { floor: true } },
          },
        },
      },
    });
    if (!vehicle) throw new AppError(404, 'Không tìm thấy xe');
    if (vehicle.ownerId !== userId) throw new AppError(403, 'Bạn không có quyền xem xe này');
    return vehicle;
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
