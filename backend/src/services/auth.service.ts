import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/helpers';
import { sendOtpEmail } from './email.service';

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  plateNumber: string;
  vehicleType: 'MOTORBIKE' | 'CAR';
  role?: string;
  otp?: string;
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
    phoneNumber: string | null;
  };
}

// ── OTP Store (in-memory) ──────────────────────────────
interface OtpEntry {
  code: string;
  expiresAt: number; // timestamp ms
  fullName: string;
}
const otpStore = new Map<string, OtpEntry>();          // used for registration
const resetOtpStore = new Map<string, OtpEntry>();     // used for forgot-password
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
// ───────────────────────────────────────────────────────

export const authService = {
  async sendOtp(input: { email: string; fullName: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();

    if (!email || !fullName) {
      throw new AppError(400, 'Email và họ tên không được để trống');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'Email đã được sử dụng');
    }

    const prev = otpStore.get(email);
    if (prev && prev.expiresAt - OTP_TTL_MS + OTP_COOLDOWN_MS > Date.now()) {
      throw new AppError(429, 'Vui lòng đợi 60 giây trước khi gửi lại mã');
    }

    const code = generateOtp();
    otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, fullName });

    setTimeout(() => {
      const entry = otpStore.get(email);
      if (entry && entry.code === code) {
        otpStore.delete(email);
      }
    }, OTP_TTL_MS + 1000);

    await sendOtpEmail(email, code, fullName);
    console.log(`[OTP] Sent to ${email}: ${code}`);
  },

  async forgotPasswordSendOtp(input: { email: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new AppError(400, 'Vui lòng nhập email');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'Email này chưa được đăng ký trong hệ thống');
    }

    const prev = resetOtpStore.get(email);
    if (prev && prev.expiresAt - OTP_TTL_MS + OTP_COOLDOWN_MS > Date.now()) {
      throw new AppError(429, 'Vui lòng đợi 60 giây trước khi gửi lại mã');
    }

    const code = generateOtp();
    resetOtpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, fullName: user.fullName });

    setTimeout(() => {
      const entry = resetOtpStore.get(email);
      if (entry && entry.code === code) {
        resetOtpStore.delete(email);
      }
    }, OTP_TTL_MS + 1000);

    await sendOtpEmail(email, code, user.fullName);
    console.log(`[Reset-OTP] Sent to ${email}: ${code}`);
  },

  async resetPassword(input: { email: string; otp: string; newPassword: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();

    if (!input.otp) {
      throw new AppError(400, 'Vui lòng nhập mã xác nhận OTP');
    }
    if (!input.newPassword || input.newPassword.length < 6) {
      throw new AppError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const entry = resetOtpStore.get(email);
    if (!entry) {
      throw new AppError(400, 'Mã xác nhận không tồn tại hoặc đã hết hạn. Vui lòng gửi lại mã.');
    }
    if (Date.now() > entry.expiresAt) {
      resetOtpStore.delete(email);
      throw new AppError(400, 'Mã xác nhận đã hết hạn. Vui lòng gửi lại mã.');
    }
    if (entry.code !== input.otp.trim()) {
      throw new AppError(400, 'Mã xác nhận không chính xác');
    }
    resetOtpStore.delete(email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();

    // ── Verify OTP ──
    if (!input.otp) {
      throw new AppError(400, 'Vui lòng nhập mã xác nhận OTP');
    }
    const entry = otpStore.get(email);
    if (!entry) {
      throw new AppError(400, 'Mã xác nhận không tồn tại hoặc đã hết hạn. Vui lòng gửi lại mã.');
    }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email);
      throw new AppError(400, 'Mã xác nhận đã hết hạn. Vui lòng gửi lại mã.');
    }
    if (entry.code !== input.otp.trim()) {
      throw new AppError(400, 'Mã xác nhận không chính xác');
    }
    // OTP valid → consume it
    otpStore.delete(email);

    // ── Existing checks ──
    const existingEmail = await prisma.user.findUnique({ where: { email } });
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
        email,
        phoneNumber: input.phoneNumber ?? null,
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
        phoneNumber: user.phoneNumber ?? null,
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
        phoneNumber: user.phoneNumber ?? null,
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

  async updateProfile(userId: string, input: { fullName?: string; phoneNumber?: string | null }) {
    if (input.fullName !== undefined && !input.fullName.trim()) {
      throw new AppError(400, 'Họ tên không được để trống');
    }
    const data: any = {};
    if (input.fullName !== undefined) {
      data.fullName = input.fullName.trim();
    }
    if (input.phoneNumber !== undefined) {
      if (input.phoneNumber !== null) {
        const trimmedPhone = input.phoneNumber.trim();
        if (trimmedPhone && !/^0\d{9,10}$/.test(trimmedPhone)) {
          throw new AppError(400, 'Số điện thoại không hợp lệ');
        }
        data.phoneNumber = trimmedPhone || null;
      } else {
        data.phoneNumber = null;
      }
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data,
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

  async deleteAccount(userId: string, password?: string) {
    if (!password) {
      throw new AppError(400, 'Vui lòng cung cấp mật khẩu để xác nhận.');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'Không tìm thấy tài khoản.');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(400, 'Mật khẩu xác nhận không chính xác.');
    }

    return await prisma.$transaction(async (tx) => {
      const vehicles = await tx.vehicle.findMany({
        where: { ownerId: userId },
      });
      const vehicleIds = vehicles.map((v) => v.id);

      if (vehicleIds.length > 0) {
        const activeCheckIn = await tx.checkInRecord.findFirst({
          where: {
            vehicleId: { in: vehicleIds },
            status: 'PARKING',
          },
        });
        if (activeCheckIn) {
          throw new AppError(400, 'Không thể xóa tài khoản khi xe của bạn đang đỗ trong bãi.');
        }

        const checkInRecords = await tx.checkInRecord.findMany({
          where: { vehicleId: { in: vehicleIds } },
        });
        const checkInRecordIds = checkInRecords.map((r) => r.id);

        if (checkInRecordIds.length > 0) {
          await tx.payment.deleteMany({
            where: { checkInRecordId: { in: checkInRecordIds } },
          });
        }

        const packages = await tx.monthlyPackage.findMany({
          where: { vehicleId: { in: vehicleIds } },
        });
        const packageIds = packages.map((p) => p.id);

        if (packageIds.length > 0) {
          await tx.payment.deleteMany({
            where: { monthlyPackageId: { in: packageIds } },
          });
        }
        await tx.monthlyPackage.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        });

        await tx.booking.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        });

        await tx.checkInRecord.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        });

        await tx.parkingSlot.updateMany({
          where: { assignedVehicleId: { in: vehicleIds } },
          data: { assignedVehicleId: null },
        });

        await tx.vehicle.deleteMany({
          where: { ownerId: userId },
        });
      }

      await tx.checkInRecord.updateMany({
        where: { checkedInById: userId },
        data: { checkedInById: null },
      });
      await tx.checkInRecord.updateMany({
        where: { checkedOutById: userId },
        data: { checkedOutById: null },
      });
      await tx.payment.updateMany({
        where: { collectedById: userId },
        data: { collectedById: null },
      });

      await tx.booking.deleteMany({
        where: { createdById: userId },
      });

      await tx.monthlyPackage.deleteMany({
        where: { userId: userId },
      });

      await tx.user.delete({ where: { id: userId } });
    });
  },
};