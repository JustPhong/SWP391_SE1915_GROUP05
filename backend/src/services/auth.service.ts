import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/helpers';

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  plateNumber: string;
  vehicleType: 'MOTORBIKE' | 'CAR';
  role?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) {
      throw new AppError(409, 'Email already in use');
    }

    const existingPlate = await prisma.vehicle.findUnique({ where: { plateNumber: input.plateNumber } });
    if (existingPlate) {
      throw new AppError(409, 'This license plate is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const roleName = input.role ?? 'DRIVER';
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new AppError(400, 'Invalid role');
   
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        roleId: role.id,
      },
    });

    await prisma.vehicle.create({
      data: {
        plateNumber: input.plateNumber,
        type: input.vehicleType,
        ownerId: user.id,
        isMonthly: false,
        brand: (input as any).brand || undefined,
        model: (input as any).model || undefined,
        color: (input as any).color || undefined,
        year: (input as any).year || undefined,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: roleName },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: roleName,
      },
    };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { roleRef: true },
    });
    if (!user) {
      throw new AppError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new AppError(403, 'Tài khoản đã bị khóa');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid email or password');
    }

    const roleName = user.roleRef!.name;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: roleName },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: roleName,
      },
    };
  },

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roleRef: true },
    });
    if (!user) throw new AppError(404, 'User not found');
    return user;
  },

  async updateProfile(userId: string, input: { fullName?: string }) {
    if (!input.fullName || !input.fullName.trim()) {
      throw new AppError(400, 'Họ tên không được để trống');
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { fullName: input.fullName.trim() },
      include: { roleRef: true },
    });
    return user;
  },

  async changePassword(userId: string, input: { currentPassword: string; newPassword: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found');
    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) throw new AppError(400, 'Mật khẩu hiện tại không đúng');
    if (!input.newPassword || input.newPassword.length < 6) {
      throw new AppError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      include: { roleRef: true },
    });
    return user;
  },

  async removeAvatar(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      include: { roleRef: true },
    });
    return user;
  },
};
