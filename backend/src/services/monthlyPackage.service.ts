import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { sendEmail } from './email.service';

const SLOT_AVAILABLE = 'AVAILABLE';
const SLOT_RESERVED = 'RESERVED';
const PKG_ACTIVE = 'ACTIVE';
const PKG_EXPIRED = 'EXPIRED';
const FLOOR_MONTHLY = 'MONTHLY';
const VEHICLE_CAR = 'CAR';
const VEHICLE_MOTORBIKE = 'MOTORBIKE';
const SLOT_TYPE_CAR = 'CAR';

export interface CreatePackageInput {
  userId: string;
  vehicleId: string;
  slotId?: string;
  planId?: string;
  startDate: Date;
  expiryDate: Date;
  price: number;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
  vehicleType?: string;
}

export function getTierFromPlan(planId: string | null, durationDays: number): 'VIP' | 'POPULAR' | 'REGULAR' {
  if (planId === '1y') return 'VIP';
  if (planId === '3m') return 'POPULAR';
  if (planId === '1m') return 'REGULAR';
  if (durationDays > 100) return 'VIP';
  if (durationDays > 35) return 'POPULAR';
  return 'REGULAR';
}
     
export const monthlyPackageService = {
  async create(input: CreatePackageInput) {
    if (input.expiryDate <= input.startDate) {
      throw new AppError(400, 'Expiry date must be after start date');
    }
    if (input.expiryDate <= new Date()) {
      throw new AppError(400, 'Expiry date must be in the future');
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    
    // 1. belongs to the authenticated user
    if (vehicle.ownerId !== input.userId) {
      throw new AppError(403, 'Bạn không có quyền với xe này');
    }

    // 2. matches the package vehicle type
    if (input.vehicleType && vehicle.type !== input.vehicleType) {
      throw new AppError(400, 'Phương tiện không khớp với loại gói đăng ký');
    }

    // 3. has no active, paid, non-expired monthly package
    const now = new Date();
    const existingActive = await prisma.monthlyPackage.findFirst({
      where: {
        vehicleId: input.vehicleId,
        status: PKG_ACTIVE,
        expiryDate: { gt: now },
      },
      include: {
        payments: true,
      },
    });

    const isActivePaid = existingActive && (
      existingActive.payments.length === 0 ||
      existingActive.payments.some(p => p.status === 'SUCCESS')
    );

    if (isActivePaid) {
      throw new AppError(400, 'Phương tiện này đang có gói tháng còn hiệu lực.');
    }

    return prisma.$transaction(async (tx) => {
      // Resolve vehicle type (used to branch CAR / MOTORBIKE slot policy)
      const vehicleType = vehicle.type;

      let resolvedSlotId: string | null = null;
      let allowedTierValue: string | null = null;

      const durationMs = input.expiryDate.getTime() - input.startDate.getTime();
      const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
      const resolvedTier = getTierFromPlan(input.planId ?? null, durationDays);

      if (vehicleType === VEHICLE_CAR) {
        // CAR monthly packages DO NOT pick a physical slot.
        // Determine zone tier based on planName/duration
        // Check quota: VIP: 4, POPULAR: 8, REGULAR: 8
        const soldCount = await tx.monthlyPackage.count({
          where: {
            status: PKG_ACTIVE,
            expiryDate: { gte: new Date() },
            vehicle: { type: VEHICLE_CAR },
            allowedTier: resolvedTier,
          },
        });

        const capacities = { VIP: 4, POPULAR: 8, REGULAR: 8 };
        const capacity = capacities[resolvedTier];

        if (soldCount >= capacity) {
          throw new AppError(400, 'Hiện khu vực của gói này đã đủ số lượng đăng ký. Vui lòng chọn gói khác hoặc liên hệ hỗ trợ.');
        }

        allowedTierValue = resolvedTier;
      } else if (vehicleType === VEHICLE_MOTORBIKE) {
        // MOTORBIKE monthly packages also use tiered areas.
        // Check quota: VIP: 12, POPULAR: 16, REGULAR: 12
        const soldCount = await tx.monthlyPackage.count({
          where: {
            status: PKG_ACTIVE,
            expiryDate: { gte: new Date() },
            vehicle: { type: VEHICLE_MOTORBIKE },
            allowedTier: resolvedTier,
          },
        });

        const capacities = { VIP: 12, POPULAR: 16, REGULAR: 12 };
        const capacity = capacities[resolvedTier];

        if (soldCount >= capacity) {
          throw new AppError(400, 'Hiện khu vực của gói này đã đủ số lượng đăng ký. Vui lòng chọn gói khác hoặc liên hệ hỗ trợ.');
        }

        allowedTierValue = resolvedTier;
      }

      const pkg = await tx.monthlyPackage.create({
        data: {
          userId: input.userId,
          vehicleId: input.vehicleId,
          slotId: resolvedSlotId,
          planName: input.planId ?? null,
          startDate: input.startDate,
          expiryDate: input.expiryDate,
          price: input.price,
          status: PKG_ACTIVE,
          allowedTier: allowedTierValue,
        },
      });

      await tx.payment.create({
        data: {
          monthlyPackageId: pkg.id,
          amount: input.price,
          method: input.paymentMethod,
          type: 'MONTHLY',
        },
      });

      // FIX: vehicle.isMonthly must flip to true on EVERY package creation,
      // regardless of whether a slot was reserved.
      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { isMonthly: true },
      });

      return tx.monthlyPackage.findUnique({
        where: { id: pkg.id },
        include: { vehicle: true, slot: true, payments: true },
      });
    });
  },

  async expireStalePackages() {
    return prisma.monthlyPackage.updateMany({
      where: {
        status: PKG_ACTIVE,
        expiryDate: { lt: new Date() },
      },
      data: { status: PKG_EXPIRED },
    });
  },

  async getActivePackages() {
    return prisma.monthlyPackage.findMany({
      where: { status: PKG_ACTIVE },
      include: { user: true, vehicle: true, slot: true },
    });
  },

  async getByUser(userId: string) {
    return prisma.monthlyPackage.findMany({
      where: { userId },
      include: { vehicle: true, slot: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getByVehicle(vehicleId: string) {
    return prisma.monthlyPackage.findFirst({
      where: { vehicleId },
      include: { user: true, vehicle: true, slot: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async renewPackage(packageId: string, userId: string) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { user: true },
    });
    if (!pkg) throw new AppError(404, 'Gói tháng không tồn tại');
    if (pkg.userId !== userId) throw new AppError(403, 'Không có quyền gia hạn gói này');

    const now = new Date();
    const durationMs = pkg.expiryDate.getTime() - pkg.startDate.getTime();
    if (durationMs <= 0) {
      throw new AppError(400, 'Không thể xác định thời hạn gói để gia hạn');
    }

    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
    const renewFrom = pkg.expiryDate > now ? pkg.expiryDate : now;
    const newExpiryDate = new Date(renewFrom);
    newExpiryDate.setDate(newExpiryDate.getDate() + durationDays);
    const newStartDate = pkg.expiryDate > now ? pkg.startDate : now;

    const updated = await prisma.monthlyPackage.update({
      where: { id: packageId },
      data: {
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        status: PKG_ACTIVE,
      },
      include: { user: true, vehicle: true, slot: true, payments: true },
    });

    if (updated.user?.email) {
      await sendEmail(
        updated.user.email,
        'Xác nhận gia hạn gói tháng',
        `Chào bạn,<br/><br/>Gói tháng của bạn đã được gia hạn thành công. Ngày hết hạn mới là <strong>${newExpiryDate.toLocaleDateString('vi-VN')}</strong>.<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.`
      );
    }

    return updated;
  },

  async setAutoRenew(packageId: string, userId: string, enabled: boolean) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { user: true },
    });
    if (!pkg) throw new AppError(404, 'Gói tháng không tồn tại');
    if (pkg.userId !== userId) throw new AppError(403, 'Không có quyền thay đổi cài đặt này');

    const updated = await prisma.monthlyPackage.update({
      where: { id: packageId },
      data: { autoRenew: enabled },
      include: { user: true, vehicle: true, slot: true, payments: true },
    });

    if (enabled && updated.user?.email) {
      await sendEmail(
        updated.user.email,
        'Gia hạn gói tháng được bật',
        `Chào bạn,<br/><br/>Bạn đã bật chế độ gia hạn tự động cho gói tháng. Chúng tôi sẽ thông báo khi gói được gia hạn.<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.`
      );
    }

    return updated;
  },

  async cancelPackage(packageId: string, userId: string) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { user: true, vehicle: true },
    });
    if (!pkg) throw new AppError(404, 'Gói tháng không tồn tại');
    if (pkg.userId !== userId) throw new AppError(403, 'Không có quyền hủy gói này');
    if (pkg.status !== PKG_ACTIVE) throw new AppError(400, 'Gói tháng không ở trạng thái hoạt động');

    return prisma.$transaction(async (tx) => {
      // 1. Update package status to CANCELLED and disable auto-renew
      const updated = await tx.monthlyPackage.update({
        where: { id: packageId },
        data: { status: 'CANCELLED', autoRenew: false },
        include: { user: true, vehicle: true, slot: true, payments: true },
      });

      // 2. Set vehicle isMonthly = false
      await tx.vehicle.update({
        where: { id: pkg.vehicleId },
        data: { isMonthly: false },
      });

      // 3. Clean up slot reservation if it exists
      if (pkg.slotId) {
        const slot = await tx.parkingSlot.findUnique({
          where: { id: pkg.slotId },
        });
        if (slot) {
          const newStatus = slot.status === 'RESERVED' ? 'AVAILABLE' : slot.status;
          await tx.parkingSlot.update({
            where: { id: pkg.slotId },
            data: {
              status: newStatus,
              isFixed: false,
              assignedVehicleId: null,
            },
          });
        }
      }

      if (updated.user?.email) {
        await sendEmail(
          updated.user.email,
          'Xác nhận hủy gói tháng',
          `Chào bạn,<br/><br/>Gói tháng cho xe <strong>${pkg.vehicle?.plateNumber ?? pkg.vehicleId}</strong> đã được hủy thành công.<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.`
        );
      }

      return updated;
    });
  },

  async getZoneQuotas() {
    const capacitiesCAR = {
      VIP: 4,
      POPULAR: 8,
      REGULAR: 8,
    };
    const capacitiesMOTO = {
      VIP: 12,
      POPULAR: 16,
      REGULAR: 12,
    };

    const activeCarPackages = await prisma.monthlyPackage.findMany({
      where: {
        status: PKG_ACTIVE,
        expiryDate: { gte: new Date() },
        vehicle: { type: VEHICLE_CAR },
      },
      select: {
        id: true,
        allowedTier: true,
      },
    });

    const activeMotoPackages = await prisma.monthlyPackage.findMany({
      where: {
        status: PKG_ACTIVE,
        expiryDate: { gte: new Date() },
        vehicle: { type: VEHICLE_MOTORBIKE },
      },
      select: {
        id: true,
        allowedTier: true,
      },
    });

    const soldCar = {
      VIP: 0,
      POPULAR: 0,
      REGULAR: 0,
    };
    const soldMoto = {
      VIP: 0,
      POPULAR: 0,
      REGULAR: 0,
    };

    for (const pkg of activeCarPackages) {
      const tier = pkg.allowedTier as 'VIP' | 'POPULAR' | 'REGULAR';
      if (tier && soldCar[tier] !== undefined) {
        soldCar[tier]++;
      }
    }

    for (const pkg of activeMotoPackages) {
      const tier = pkg.allowedTier as 'VIP' | 'POPULAR' | 'REGULAR';
      if (tier && soldMoto[tier] !== undefined) {
        soldMoto[tier]++;
      }
    }

    return {
      VIP: {
        capacity: capacitiesCAR.VIP,
        sold: soldCar.VIP,
        remaining: Math.max(0, capacitiesCAR.VIP - soldCar.VIP),
      },
      POPULAR: {
        capacity: capacitiesCAR.POPULAR,
        sold: soldCar.POPULAR,
        remaining: Math.max(0, capacitiesCAR.POPULAR - soldCar.POPULAR),
      },
      REGULAR: {
        capacity: capacitiesCAR.REGULAR,
        sold: soldCar.REGULAR,
        remaining: Math.max(0, capacitiesCAR.REGULAR - soldCar.REGULAR),
      },
      CAR: {
        VIP: {
          capacity: capacitiesCAR.VIP,
          sold: soldCar.VIP,
          remaining: Math.max(0, capacitiesCAR.VIP - soldCar.VIP),
        },
        POPULAR: {
          capacity: capacitiesCAR.POPULAR,
          sold: soldCar.POPULAR,
          remaining: Math.max(0, capacitiesCAR.POPULAR - soldCar.POPULAR),
        },
        REGULAR: {
          capacity: capacitiesCAR.REGULAR,
          sold: soldCar.REGULAR,
          remaining: Math.max(0, capacitiesCAR.REGULAR - soldCar.REGULAR),
        },
      },
      MOTORBIKE: {
        VIP: {
          capacity: capacitiesMOTO.VIP,
          sold: soldMoto.VIP,
          remaining: Math.max(0, capacitiesMOTO.VIP - soldMoto.VIP),
        },
        POPULAR: {
          capacity: capacitiesMOTO.POPULAR,
          sold: soldMoto.POPULAR,
          remaining: Math.max(0, capacitiesMOTO.POPULAR - soldMoto.POPULAR),
        },
        REGULAR: {
          capacity: capacitiesMOTO.REGULAR,
          sold: soldMoto.REGULAR,
          remaining: Math.max(0, capacitiesMOTO.REGULAR - soldMoto.REGULAR),
        },
      },
    };
  },
};

