import prisma from '../config/db';
import { AppError } from '../utils/helpers';

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
  startDate: Date;
  expiryDate: Date;
  price: number;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
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

    const existingActive = await prisma.monthlyPackage.findFirst({
      where: { vehicleId: input.vehicleId, status: PKG_ACTIVE },
    });
    if (existingActive) {
      throw new AppError(409, 'Vehicle already has an active monthly package');
    }

    return prisma.$transaction(async (tx) => {
      // Resolve vehicle type (used to branch CAR / MOTORBIKE slot policy)
      const vehicleType = vehicle.type;

      let resolvedSlotId: string | null = null;

      if (vehicleType === VEHICLE_CAR) {
        // CAR monthly packages require a user-picked fixed slot.
        if (!input.slotId) {
          throw new AppError(400, 'Vui lòng chọn chỗ đỗ cố định');
        }

        // Load slot with its floor so we can validate type + zone in one query.
        const slot = await tx.parkingSlot.findUnique({
          where: { id: input.slotId },
          include: { floor: true },
        });
        if (!slot) {
          throw new AppError(400, 'Chỗ đỗ không hợp lệ');
        }
        if (slot.type !== SLOT_TYPE_CAR || slot.floor.customerType !== FLOOR_MONTHLY) {
          throw new AppError(400, 'Chỗ đỗ không hợp lệ');
        }
        // BR-2 capacity is enforced by this check: floor G has exactly 20
        // physical CAR slots, so once all 20 are RESERVED none remain
        // AVAILABLE and the request fails here. No count() needed.
        if (slot.status !== SLOT_AVAILABLE) {
          throw new AppError(409, 'Chỗ đỗ đã được người khác chọn');
        }

        await tx.parkingSlot.update({
          where: { id: input.slotId },
          data: {
            status: SLOT_RESERVED,
            assignedVehicleId: input.vehicleId,
            isFixed: true,
          },
        });
        resolvedSlotId = input.slotId;
      }
      // MOTORBIKE branch: no fixed slot. resolvedSlotId stays null and
      // input.slotId is intentionally ignored (it must not be honored even
      // if the caller passes one).

      const pkg = await tx.monthlyPackage.create({
        data: {
          userId: input.userId,
          vehicleId: input.vehicleId,
          slotId: resolvedSlotId,
          startDate: input.startDate,
          expiryDate: input.expiryDate,
          price: input.price,
          status: PKG_ACTIVE,
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
      // regardless of whether a slot was reserved. Previously this was
      // gated on `!input.slotId`, which silently failed to mark slotted
      // (CAR) vehicles as monthly.
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
};
