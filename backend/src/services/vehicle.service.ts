import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { normalizeLicensePlate } from '../utils/plate';

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
function validateLicensePlate(normalizedPlate: string, vehicleType: string) {
  if (vehicleType === 'CAR') {
    if (!/^\d{2}[A-Z]\d{5}$/.test(normalizedPlate)) {
      throw new AppError(400, 'Biển số ô tô không hợp lệ. Ví dụ: 51A-731.89');
    }
  } else if (vehicleType === 'MOTORBIKE') {
    if (!/^\d{2}.+$/.test(normalizedPlate)) {
      throw new AppError(400, 'Biển xe máy không hợp lệ. Phải bắt đầu bằng 2 số tỉnh (ví dụ: 59-AB 234.56).');
    }
  }
}

export const vehicleService = {
  async create(input: CreateVehicleInput) {
    const normalizedPlate = normalizeLicensePlate(input.plateNumber);
    if (!normalizedPlate) {
      throw new AppError(400, 'Biển số xe không hợp lệ.');
    }

    validateLicensePlate(normalizedPlate, input.type);

    // Fetch all vehicles to perform global duplicate comparison in-memory
    // to correctly match historical records with surrounding whitespace
    const candidates = await prisma.vehicle.findMany({
      select: {
        id: true,
        plateNumber: true,
      },
    });

    const isDuplicate = candidates.some(v => normalizeLicensePlate(v.plateNumber) === normalizedPlate);
    if (isDuplicate) {
      throw new AppError(409, 'Biển số xe này đã được đăng ký.');
    }

    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
    });
    if (!owner) {
      throw new AppError(404, 'Không tìm thấy thông tin chủ xe');
    }

    const data = {
      plateNumber: normalizedPlate,
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
            allowedTier: true,
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

      isMonthly: (() => {
        const pkg = vehicle.monthlyPackage;
        if (!pkg) return false;
        if (pkg.status !== 'ACTIVE') return false;
        if (!pkg.expiryDate) return false;
        return new Date(pkg.expiryDate).getTime() > Date.now();
      })(),

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
      include: {
        monthlyPackage: {
          include: {
            payments: true,
          },
        },
        checkInRecords: {
          where: { checkOutTime: null },
        },
        bookings: {
          where: {
            status: { in: ['ACTIVE', 'PENDING_PAYMENT'] }
          }
        }
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
          include: {
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

    if (data.plateNumber !== undefined) {
      const normalizedPlate = normalizeLicensePlate(data.plateNumber);
      if (!normalizedPlate) {
        throw new AppError(400, 'Biển số xe không hợp lệ.');
      }

      const resolvedType = data.type || vehicle.type;
      validateLicensePlate(normalizedPlate, resolvedType);

      if (normalizedPlate !== normalizeLicensePlate(vehicle.plateNumber)) {
        const candidates = await prisma.vehicle.findMany({
          where: {
            id: { not: id },
          },
          select: {
            id: true,
            plateNumber: true,
          },
        });
        const isDuplicate = candidates.some(v => normalizeLicensePlate(v.plateNumber) === normalizedPlate);
        if (isDuplicate) {
          throw new AppError(409, 'Biển số xe này đã được đăng ký.');
        }
      }
      data.plateNumber = normalizedPlate;
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
