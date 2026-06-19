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

    const roleRow = await prisma.role.findUnique({
      where: { name: req.user.role },
    });

    if (!roleRow) {
      return next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này'));
    }

    const row = await prisma.rolePermission.findFirst({
      where: { roleId: roleRow.id, permissionKey },
    });

    if (!row) {
      return next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này'));
    }

    if (!row.allowed) {
      return next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này'));
    }

    next();
  };
};
