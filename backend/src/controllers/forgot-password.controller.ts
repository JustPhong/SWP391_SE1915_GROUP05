import { Response } from 'express';
import { asyncHandler } from '../utils/helpers';
import { authService } from '../services/auth.service';

export const forgotPasswordController = {
  forgotPassword: asyncHandler(async (req: any, res: Response) => {
    await authService.forgotPasswordSendOtp(req.body);
    return res.status(200).json({ success: true, message: 'Mã xác nhận đã được gửi đến email của bạn' });
  }),

  resetPassword: asyncHandler(async (req: any, res: Response) => {
    await authService.resetPassword(req.body);
    return res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });
  }),
};