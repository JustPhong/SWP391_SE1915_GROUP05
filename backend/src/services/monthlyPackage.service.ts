import prisma from '../config/db';
import { AppError } from '../utils/helpers';

const SLOT_AVAILABLE = 'AVAILABLE';
const SLOT_RESERVED = 'RESERVED';
const PKG_ACTIVE = 'ACTIVE';
const PKG_EXPIRED = 'EXPIRED';

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
      if (input.slotId) {
        const slot = await tx.parkingSlot.findUnique({ where: { id: input.slotId } });
        if (!slot) throw new AppError(404, 'Slot not found');
        if (slot.status !== SLOT_AVAILABLE) {
          throw new AppError(409, 'Slot is not available');
        }
        await tx.parkingSlot.update({
          where: { id: input.slotId },
          data: { status: SLOT_RESERVED, assignedVehicleId: input.vehicleId, isFixed: true },
        });
      }

      const pkg = await tx.monthlyPackage.create({
        data: {
          userId: input.userId,
          vehicleId: input.vehicleId,
          slotId: input.slotId,
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

      if (!input.slotId) {
        await tx.vehicle.update({
          where: { id: input.vehicleId },
          data: { isMonthly: true },
        });
      }

      return prisma.monthlyPackage.findUnique({
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
