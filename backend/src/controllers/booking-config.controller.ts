import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';
import { bookingConfigService } from '../services/booking-config.service';

export const bookingConfigController = {
  get: asyncHandler(async (req: AuthRequest, res: Response) => {
    const config = await bookingConfigService.getBookingConfig();
    return res.status(200).json({
      success: true,
      data: {
        depositAmount: Number(config.depositAmount),
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { depositAmount } = req.body;

    if (depositAmount === undefined || depositAmount === null) {
      throw new AppError(400, 'Số tiền đặt cọc không được để trống.');
    }

    const numericAmount = Number(depositAmount);
    if (isNaN(numericAmount)) {
      throw new AppError(400, 'Số tiền đặt cọc phải là một số hợp lệ.');
    }

    const config = await bookingConfigService.updateBookingConfig(numericAmount);

    return res.status(200).json({
      success: true,
      data: {
        depositAmount: Number(config.depositAmount),
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  }),
};
