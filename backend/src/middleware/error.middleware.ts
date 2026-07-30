import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../utils/helpers';

export const validate = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(400, messages));
  }
  next();
};   

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errorCode ? { errorCode: err.errorCode } : {})
    });
  }

  console.error('[Error]', err);
  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json({
    success: false,
    message: isDev ? err.message : 'Internal server error',
  });
};

export const notFoundHandler = (_req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};
