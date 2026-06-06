import prisma from '../config/db';
import { AppError } from '../utils/helpers';

export interface RecordPaymentInput {
  checkInRecordId?: string;
  monthlyPackageId?: string;
  amount: number;
  method: string;
  type: string;
}

export const paymentService = {
  async recordPayment(input: RecordPaymentInput) {
    if (!input.checkInRecordId && !input.monthlyPackageId) {
      throw new AppError(400, 'Either checkInRecordId or monthlyPackageId must be provided');
    }

    return prisma.payment.create({ data: input });
  },

  async getPaymentsByCheckIn(checkInRecordId: string) {
    return prisma.payment.findMany({
      where: { checkInRecordId },
    });
  },

  async getPaymentsByPackage(monthlyPackageId: string) {
    return prisma.payment.findMany({
      where: { monthlyPackageId },
    });
  },

  async getAllPayments(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate) where.paidAt = { ...where.paidAt, gte: startDate };
    if (endDate) where.paidAt = { ...where.paidAt, lte: endDate };

    return prisma.payment.findMany({
      where,
      include: {
        checkInRecord: { include: { vehicle: true } },
        monthlyPackage: { include: { user: true, vehicle: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
  },
};
