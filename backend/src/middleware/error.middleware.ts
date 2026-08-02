import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../utils/helpers';

import { Prisma } from '@prisma/client';

export const validate = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(400, messages));
  }
  next();
};   

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errorCode ? { errorCode: err.errorCode, code: err.errorCode } : {}),
      ...(err.reasons ? { reasons: err.reasons } : {}),
    });
  }

  console.error('[Error]', err);

  const isPrismaError =
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err.name?.includes('Prisma') ||
    err.message?.includes('Prisma') ||
    err.message?.includes('foreign key') ||
    err.message?.includes('constraint');

  if (isPrismaError) {
    const isProfileDeletion = req.method === 'DELETE' && req.path.includes('/profile');
    if (isProfileDeletion) {
      return res.status(409).json({
        success: false,
        code: 'ACCOUNT_DELETION_FAILED',
        message: 'Không thể xóa tài khoản do vẫn còn dữ liệu liên quan cần được xử lý.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra với hệ thống dữ liệu. Vui lòng thử lại sau.',
    });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const containsInternalInfo = err.message && (
    err.message.includes('Project_Cursor') ||
    err.message.includes('fkey') ||
    err.message.includes('constraint') ||
    err.message.includes('SQL Server')
  );

  return res.status(500).json({
    success: false,
    message: (isDev && !containsInternalInfo) ? err.message : 'Internal server error',
  });
};

export const notFoundHandler = (_req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};
