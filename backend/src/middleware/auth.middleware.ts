import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/helpers';
import type { UserRole } from '../utils/enums';

import prisma from '../config/db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'No token provided'));
  }   

  const token = header.slice(7);
  let decoded: { id: string; email: string; role: string };

  try {
    decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      role: string;
    };
  } catch {
    return next(new AppError(401, 'Invalid or expired token'));
  }

  try {
    // Reload user from DB to verify isActive status and load real-time role
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { roleRef: true }
    });

    if (!dbUser || !dbUser.isActive) {
      return next(new AppError(401, 'Invalid or expired token'));
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.roleRef.name
    };
    next();
  } catch (err) {
    next(err); // Forward database errors to the global error handler
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Not authenticated'));
    }
    const userRole = req.user.role.toUpperCase() as UserRole;
    if (!roles.map((r) => r.toUpperCase()).includes(userRole)) {
      return next(new AppError(403, 'Insufficient permissions'));
    }
    next();
  };
};
