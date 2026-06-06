import { Response } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

export const authController = {
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
        role: user.role,
      },
    });
  }),
};
