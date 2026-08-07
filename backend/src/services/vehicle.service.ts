import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { normalizeLicensePlate } from '../utils/plate';

function formatVehiclePackage(vehicle: any) {
  if (!vehicle) return vehicle;
  if (vehicle.monthlyPackage) {
    const pkg = vehicle.monthlyPackage;
    const now = new Date();
    const isExpiredActive = pkg.status === 'ACTIVE' && pkg.expiryDate <= now;
    const effectiveStatus = isExpiredActive ? 'EXPIRED' : pkg.status;
    const isEffectivelyActive = pkg.status === 'ACTIVE' && pkg.expiryDate > now;
    vehicle.monthlyPackage = {
      ...pkg,
      effectiveStatus,
      isEffectivelyActive,
    };
  }
  return vehicle;
}

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

/**
 * Allow-listed fields that a vehicle owner may update through the API.
 * ownerId, isMonthly, and owner-contact snapshot fields are intentionally excluded
 * to prevent ownership mutation and data-integrity issues.
 */
export interface UpdateVehicleInput {
  plateNumber?: string;
  type?: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  seats?: number | null;
}
    
async function loadOwnedVehicleOrThrow(vehicleId: string, userId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.isArchived) {
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
    const cleanedPlate = input.plateNumber.trim().toUpperCase();
    const normalizedPlate = normalizeLicensePlate(cleanedPlate);
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
        ownerId: true,
        isArchived: true,
      },
    });

    const matchingCandidate = candidates.find(v => normalizeLicensePlate(v.plateNumber) === normalizedPlate);
    if (matchingCandidate) {
      const owner = await prisma.user.findUnique({
        where: { id: input.ownerId },
      });
      if (!owner) {
        throw new AppError(404, 'Không tìm thấy thông tin chủ xe');
      }

      if (matchingCandidate.ownerId === input.ownerId && matchingCandidate.isArchived) {
        // Before restoring, check if there is an active guest parking session on this vehicle
        const activeCheckIn = await prisma.checkInRecord.findFirst({
          where: {
            vehicleId: matchingCandidate.id,
            checkOutTime: null,
            status: 'PARKING',
          },
          select: { id: true },
        });
        if (activeCheckIn) {
          throw new AppError(409, 'Xe hiện đang có phiên gửi trong bãi. Vui lòng hoàn tất phiên gửi trước khi khôi phục xe.');
        }

        // SAME OWNER RESTORE: Restore vehicle, reset isMonthly = false, and update editable fields
        return prisma.vehicle.update({
          where: { id: matchingCandidate.id },
          data: {
            isArchived: false,
            isMonthly: false,
            brand: input.brand ?? null,
            model: input.model ?? null,
            color: input.color ?? null,
            year: input.year ?? null,
            seats: input.seats ?? null,
            ownerFullName: owner.fullName,
            ownerEmail: owner.email.toLowerCase(),
            ownerPhone: owner.phoneNumber ?? null,
          },
        });
      }

      // Already active under same owner OR owned by a different user -> return 409
      throw new AppError(409, 'Biển số xe này đã được đăng ký.');
    }

    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
    });
    if (!owner) {
      throw new AppError(404, 'Không tìm thấy thông tin chủ xe');
    }

    const data = {
      plateNumber: cleanedPlate,
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

  async getByPlate(plateNumber: string, includeArchived = false) {
    const normalizedInput = normalizeLicensePlate(plateNumber);
    const allVehicles = await prisma.vehicle.findMany({
      where: includeArchived ? undefined : { isArchived: false },
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

    const matching = allVehicles.filter(
      (v) => normalizeLicensePlate(v.plateNumber) === normalizedInput
    );

    if (matching.length > 1) {
      throw new AppError(409, 'Phát hiện xung đột dữ liệu: có nhiều xe trùng biển số trên hệ thống.');
    }

    const vehicle = matching[0] || null;

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

      monthlyPackage: vehicle.monthlyPackage ? (() => {
        const pkg = vehicle.monthlyPackage;
        const now = new Date();
        const isExpiredActive = pkg.status === 'ACTIVE' && pkg.expiryDate <= now;
        const effectiveStatus = isExpiredActive ? 'EXPIRED' : pkg.status;
        const isEffectivelyActive = pkg.status === 'ACTIVE' && pkg.expiryDate > now;
        return {
          ...pkg,
          effectiveStatus,
          isEffectivelyActive,
        };
      })() : null,

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
    return formatVehiclePackage(vehicle);
  },

  async getByOwner(ownerId: string) {
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerId, isArchived: false },
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
    return vehicles.map((v) => formatVehiclePackage(v));
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
    if (!vehicle || vehicle.isArchived) throw new AppError(404, 'Không tìm thấy xe');
    if (vehicle.ownerId !== userId) throw new AppError(403, 'Bạn không có quyền xem xe này');
    return formatVehiclePackage(vehicle);
  },

  async update(id: string, userId: string, input: UpdateVehicleInput) {
    const vehicle = await loadOwnedVehicleOrThrow(id, userId);

    // Build an explicit allow-listed payload — ownerId and isMonthly are never included.
    const data: {
      plateNumber?: string;
      type?: string;
      brand?: string | null;
      model?: string | null;
      color?: string | null;
      year?: number | null;
      seats?: number | null;
    } = {};

    if (input.brand !== undefined)  data.brand  = input.brand;
    if (input.model !== undefined)  data.model  = input.model;
    if (input.color !== undefined)  data.color  = input.color;
    if (input.year  !== undefined)  data.year   = input.year;
    if (input.seats !== undefined)  data.seats  = input.seats;
    if (input.type  !== undefined)  data.type   = input.type;

    if (input.plateNumber !== undefined) {
      const normalizedPlate = normalizeLicensePlate(input.plateNumber);
      if (!normalizedPlate) {
        throw new AppError(400, 'Biển số xe không hợp lệ.');
      }

      const resolvedType = input.type || vehicle.type;
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
      if (!vehicle || vehicle.isArchived) {
        throw new AppError(404, 'Không tìm thấy xe');
      }
      if (vehicle.ownerId !== userId) {
        throw new AppError(403, 'Bạn không có quyền với xe này');
      }

      const [activePackage, activeBooking, activeCheckIn, assignedSlot] = await Promise.all([
        tx.monthlyPackage.findFirst({
          where: {
            vehicleId: id,
            OR: [
              { status: 'ACTIVE', expiryDate: { gt: new Date() } },
              { status: 'PENDING_PAYMENT' }
            ]
          },
          select: { id: true },
        }),
        tx.booking.findFirst({
          where: {
            vehicleId: id,
            status: { in: ['ACTIVE', 'PENDING_PAYMENT'] }
          },
          select: { id: true },
        }),
        tx.checkInRecord.findFirst({
          where: {
            vehicleId: id,
            checkOutTime: null,
            status: 'PARKING',
          },
          select: { id: true },
        }),
        tx.parkingSlot.findFirst({
          where: { assignedVehicleId: id },
          select: { id: true },
        }),
      ]);

      if (activePackage) {
        throw new AppError(409, 'Không thể gỡ xe đang có gói tháng hoặc đang chờ thanh toán gói tháng. Vui lòng đợi gói hết hạn.');
      }
      if (activeBooking) {
        throw new AppError(409, 'Không thể gỡ xe đang có lượt đặt chỗ hoặc đang chờ thanh toán đặt chỗ.');
      }
      if (activeCheckIn) {
        throw new AppError(409, 'Không thể gỡ xe đang đỗ trong bãi.');
      }
      if (assignedSlot) {
        throw new AppError(409, 'Không thể gỡ xe đang được gán chỗ đỗ cố định.');
      }

      await tx.vehicle.update({
        where: { id },
        data: {
          isArchived: true,
          isMonthly: false,
        },
      });
    });
  },
};
