import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { AuthRequest } from './auth.middleware';

export const requirePermission = (permissionKey: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Not authenticated'));
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    const row = await prisma.rolePermission.findUnique({
      where: {
        role_permissionKey: {
          role: req.user.role,
          permissionKey,
        },
      },
    });

    if (!row) {
      return next();
    }

    if (!row.allowed) {
      return next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này'));
    }

    next();
  };
};
