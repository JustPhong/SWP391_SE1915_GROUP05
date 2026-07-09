import { Response } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const authController = {
  sendOtp: asyncHandler(async (req: AuthRequest, res: Response) => {
    await authService.sendOtp(req.body);
    return res.status(200).json({ success: true, message: 'Mã xác nhận đã được gửi đến email của bạn' });
  }),

  forgotPasswordSendOtp: asyncHandler(async (req: AuthRequest, res: Response) => {
    await authService.forgotPasswordSendOtp(req.body);
    return res.status(200).json({ success: true, message: 'Mã xác nhận đã được gửi đến email của bạn' });
  }),

  resetPassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    await authService.resetPassword(req.body);
    return res.status(200).json({ success: true, message: 'Đặt lại mật khẩu thành công' });
  }),

  register: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await authService.register(req.body);
    return res.status(201).json({ success: true, data: result });
  }),

  login: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await authService.login(req.body);
    return res.status(200).json({ success: true, data: result });
  }),

  me: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.getUserById(req.user!.id);
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.roleRef!.name,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  }),

  updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.updateProfile(req.user!.id, req.body);
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.roleRef!.name,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  }),

  changePassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    await authService.changePassword(req.user!.id, req.body);
    return res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });
  }),

  uploadAvatar: asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Không có file ảnh' });
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const user = await authService.updateAvatar(req.user!.id, avatarUrl);
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.roleRef!.name,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  }),

  removeAvatar: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.removeAvatar(req.user!.id);
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.roleRef!.name,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  }),

  deleteAccount: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { password } = req.body;
    await authService.deleteAccount(req.user!.id, password);
    return res.status(200).json({ success: true, message: 'Xóa tài khoản thành công' });
  }),
};