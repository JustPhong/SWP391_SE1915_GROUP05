import prisma from '../config/db';
import { AppError } from '../utils/helpers';

export const bookingConfigService = {
  /**
   * Retrieves the current booking configuration.
   * Auto-creates the default record (depositAmount: 15000) if it does not exist.
   */
  async getBookingConfig() {
    let config = await prisma.bookingConfig.findUnique({
      where: { id: 1 },
    });
    if (!config) {
      config = await prisma.bookingConfig.create({
        data: {
          id: 1,
          depositAmount: 15000,
        },
      });
    }
    return config;
  },

  /**
   * Updates the booking configuration amount.
   * Assumes ID is 1 (singleton).
   */
  async updateBookingConfig(amount: number) {
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      throw new AppError(400, 'Số tiền đặt cọc không hợp lệ.');
    }
    if (amount < 0) {
      throw new AppError(400, 'Số tiền đặt cọc không được là số âm.');
    }
    if (!Number.isInteger(amount)) {
      throw new AppError(400, 'Số tiền đặt cọc phải là số nguyên VND.');
    }
    // Prevent SQL Server overflow for Decimal(10, 2)
    if (amount > 99999999) {
      throw new AppError(400, 'Số tiền đặt cọc quá lớn.');
    }

    const updated = await prisma.bookingConfig.update({
      where: { id: 1 },
      data: { depositAmount: amount },
    });

    return updated;
  },
};
