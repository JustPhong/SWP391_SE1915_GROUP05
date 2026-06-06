import prisma from '../config/db';
import { AppError } from '../utils/helpers';

export interface CreateVehicleInput {
  plateNumber: string;
  type: string;
  ownerId: string;
  isMonthly?: boolean;
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

  async update(id: string, data: Partial<CreateVehicleInput>) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');

    if (data.plateNumber && data.plateNumber !== vehicle.plateNumber) {
      const existing = await prisma.vehicle.findUnique({
        where: { plateNumber: data.plateNumber },
      });
      if (existing) throw new AppError(409, 'Plate number already in use');
    }

    return prisma.vehicle.update({ where: { id }, data });
  },
};
