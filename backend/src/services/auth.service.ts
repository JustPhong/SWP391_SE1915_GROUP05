import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/helpers';
import { normalizeLicensePlate } from '../utils/plate';
import { sendOtpEmail } from './email.service';
import { randomInt, randomBytes } from 'crypto';

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

// ── OTP types ──────────────────────────────────────────
interface OtpEntry {
  code: string;
  expiresAt: number; // timestamp ms
  fullName: string;
  attempts: number;
}
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

type AuthServiceDependencies = {
  prisma: typeof prisma;
  sendOtpEmail: typeof sendOtpEmail;
};

export function createAuthService(deps: AuthServiceDependencies) {
  const otpStore = new Map<string, OtpEntry>();          // used for registration
  const resetOtpStore = new Map<string, OtpEntry>();     // used for forgot-password
  const registrationOtpSendInProgress = new Set<string>();
  const resetOtpSendInProgress = new Set<string>();

  function generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  return {
    async sendOtp(input: { email: string; fullName: string }): Promise<void> {
      if (!input.email || typeof input.email !== 'string') {
        throw new AppError(400, 'Vui lòng cung cấp email hợp lệ');
      }
      if (!input.fullName || typeof input.fullName !== 'string') {
        throw new AppError(400, 'Vui lòng cung cấp họ tên hợp lệ');
      }
      const email = input.email.trim().toLowerCase();
      const fullName = input.fullName.trim();

      if (!email || !fullName) {
        throw new AppError(400, 'Email và họ tên không được để trống');
      }

      if (registrationOtpSendInProgress.has(email)) {
        throw new AppError(429, 'Yêu cầu gửi mã OTP đang được xử lý. Vui lòng đợi.');
      }
      registrationOtpSendInProgress.add(email);

      try {
        const existing = await deps.prisma.user.findUnique({ where: { email } });
        if (existing) {
          throw new AppError(409, 'Email đã được sử dụng');
        }

        const prev = otpStore.get(email);
        if (prev && prev.expiresAt - OTP_TTL_MS + OTP_COOLDOWN_MS > Date.now()) {
          throw new AppError(429, 'Vui lòng đợi 60 giây trước khi gửi lại mã');
        }

        const code = generateOtp();

        try {
          const delivery = await deps.sendOtpEmail(email, code, fullName, 'REGISTER');
          const accepted = delivery.accepted.some(
            (recipient) => recipient.trim().toLowerCase() === email
          );
          if (!accepted) {
            throw new Error('Recipient was not accepted by the SMTP server');
          }
        } catch (error) {
          console.error('OTP email delivery failed', {
            error: error instanceof Error ? error.message : 'Unknown email delivery error',
          });
          throw new AppError(502, 'Không thể gửi email xác nhận. Vui lòng thử lại sau.');
        }

        // Persist OTP only after delivery succeeds (Option A)
        otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, fullName, attempts: 0 });

        setTimeout(() => {
          const entry = otpStore.get(email);
          if (entry && entry.code === code) {
            otpStore.delete(email);
          }
        }, OTP_TTL_MS + 1000);
      } finally {
        registrationOtpSendInProgress.delete(email);
      }
    },

    async forgotPasswordSendOtp(input: { email: string }): Promise<void> {
      if (!input.email || typeof input.email !== 'string') {
        throw new AppError(400, 'Vui lòng cung cấp email hợp lệ');
      }
      const email = input.email.trim().toLowerCase();
      if (!email) {
        throw new AppError(400, 'Vui lòng nhập email');
      }

      if (resetOtpSendInProgress.has(email)) {
        throw new AppError(429, 'Yêu cầu gửi mã OTP đang được xử lý. Vui lòng đợi.');
      }
      resetOtpSendInProgress.add(email);

      try {
        const user = await deps.prisma.user.findUnique({ where: { email } });
        if (!user) {
          throw new AppError(404, 'Email này chưa được đăng ký trong hệ thống');
        }

        const prev = resetOtpStore.get(email);
        if (prev && prev.expiresAt - OTP_TTL_MS + OTP_COOLDOWN_MS > Date.now()) {
          throw new AppError(429, 'Vui lòng đợi 60 giây trước khi gửi lại mã');
        }

        const code = generateOtp();

        try {
          const delivery = await deps.sendOtpEmail(email, code, user.fullName, 'RESET_PASSWORD');
          const accepted = delivery.accepted.some(
            (recipient) => recipient.trim().toLowerCase() === email
          );
          if (!accepted) {
            throw new Error('Recipient was not accepted by the SMTP server');
          }
        } catch (error) {
          console.error('Reset OTP email delivery failed', {
            error: error instanceof Error ? error.message : 'Unknown email delivery error',
          });
          throw new AppError(502, 'Không thể gửi email xác nhận. Vui lòng thử lại sau.');
        }

        // Persist Reset OTP only after delivery succeeds (Option A)
        resetOtpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, fullName: user.fullName, attempts: 0 });

        setTimeout(() => {
          const entry = resetOtpStore.get(email);
          if (entry && entry.code === code) {
            resetOtpStore.delete(email);
          }
        }, OTP_TTL_MS + 1000);
      } finally {
        resetOtpSendInProgress.delete(email);
      }
    },

    async resetPassword(input: { email: string; otp: string; newPassword: string }): Promise<void> {
      if (!input.email || typeof input.email !== 'string') {
        throw new AppError(400, 'Vui lòng cung cấp email hợp lệ');
      }
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
        entry.attempts += 1;
        if (entry.attempts >= 5) {
          resetOtpStore.delete(email);
          throw new AppError(400, 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng gửi lại mã mới.');
        }
        throw new AppError(400, `Mã xác nhận không chính xác. Bạn còn ${5 - entry.attempts} lần thử.`);
      }

      const user = await deps.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new AppError(404, 'Không tìm thấy tài khoản');
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await deps.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      
      // Only delete OTP after password update succeeds
      resetOtpStore.delete(email);
    },

    async register(input: RegisterInput): Promise<AuthResult> {
      if (!input.email || typeof input.email !== 'string') {
        throw new AppError(400, 'Vui lòng cung cấp email hợp lệ');
      }
      const email = input.email.trim().toLowerCase();

      // 1. Validate inputs (except database checks)
      if (!input.otp) {
        throw new AppError(400, 'Vui lòng nhập mã xác nhận OTP');
      }
      if (!input.fullName || input.fullName.trim().length === 0) {
        throw new AppError(400, 'Họ tên không được để trống');
      }
      if (!input.password || input.password.length < 6) {
        throw new AppError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
      }
      if (!input.plateNumber) {
        throw new AppError(400, 'Biển số xe không được để trống');
      }

      // 2. Validate OTP exists
      const entry = otpStore.get(email);
      if (!entry) {
        throw new AppError(400, 'Mã xác nhận không tồn tại hoặc đã hết hạn. Vui lòng gửi lại mã.');
      }

      // 3. Validate OTP is not expired
      if (Date.now() > entry.expiresAt) {
        otpStore.delete(email);
        throw new AppError(400, 'Mã xác nhận đã hết hạn. Vui lòng gửi lại mã.');
      }

      // 4. Validate OTP matches (with attempts check)
      if (entry.code !== input.otp.trim()) {
        entry.attempts += 1;
        if (entry.attempts >= 5) {
          otpStore.delete(email);
          throw new AppError(400, 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng gửi lại mã mới.');
        }
        throw new AppError(400, `Mã xác nhận không chính xác. Bạn còn ${5 - entry.attempts} lần thử.`);
      }

      // 5. Validate email is not registered
      const existingEmail = await deps.prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        throw new AppError(409, 'Email đã được sử dụng');
      }

      // 6. Validate plate is not registered (handling formatting differences)
      const normalizedRegPlate = normalizeLicensePlate(input.plateNumber);
      const allVehicles = await deps.prisma.vehicle.findMany({
        select: { plateNumber: true }
      });
      const isPlateDuplicate = allVehicles.some(
        (v) => normalizeLicensePlate(v.plateNumber) === normalizedRegPlate
      );
      if (isPlateDuplicate) {
        throw new AppError(409, 'Biển số xe này đã được đăng ký trong hệ thống');
      }

      // 7. Validate role exists
      const roleName = input.role ?? 'DRIVER';
      const role = await deps.prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        throw new AppError(400, 'Vai trò không hợp lệ');
      }

      // 8. Hash password
      const passwordHash = await bcrypt.hash(input.password, 12);

      // 9. Create user and vehicle safely using Prisma transaction
      let userResult;
      try {
        userResult = await deps.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              fullName: input.fullName.trim(),
              email,
              phoneNumber: input.phoneNumber ?? null,
              passwordHash,
              roleId: role.id,
            },
          });

          await tx.vehicle.create({
            data: {
              plateNumber: input.plateNumber.trim().toUpperCase(),
              type: input.vehicleType,
              ownerId: user.id,
              isMonthly: false,
              brand: (input as any).brand || undefined,
              model: (input as any).model || undefined,
              color: (input as any).color || undefined,
              year: (input as any).year || undefined,
            },
          });

          return user;
        });
      } catch (dbErr: any) {
        console.error('Registration database transaction failed:', dbErr instanceof Error ? dbErr.message : String(dbErr));
        throw new AppError(500, 'Đăng ký tài khoản thất bại. Vui lòng thử lại.');
      }

      // 10. Delete OTP only after registration succeeds!
      otpStore.delete(email);

      // 11. Generate JWT token
      const token = jwt.sign(
        { id: userResult.id, email: userResult.email, role: roleName },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: userResult.id,
          fullName: userResult.fullName,
          email: userResult.email,
          role: roleName,
          phoneNumber: userResult.phoneNumber ?? null,
        },
      };
    },

    async deleteAccount(userId: string, password?: string): Promise<void> {
      if (!password) {
        throw new AppError(400, 'Vui lòng cung cấp mật khẩu để xác nhận.');
      }
      const user = await deps.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) {
        throw new AppError(404, 'Không tìm thấy tài khoản.');
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new AppError(401, 'Mật khẩu không chính xác.', true, 'INVALID_PASSWORD');
      }

      const originalEmail = user.email;

      await deps.prisma.$transaction(async (tx) => {
        // Reload user inside transaction to guarantee idempotency and avoid duplicate anonymization
        const freshUser = await tx.user.findUnique({ where: { id: userId } });
        if (!freshUser || !freshUser.isActive) {
          return;
        }

        const reasons: { type: string; message: string }[] = [];

        // 1. Check for active parking sessions (vehicles currently inside the parking lot or active driver sessions)
        const vehicles = await tx.vehicle.findMany({
          where: { ownerId: userId, isArchived: false },
        });
        const vehicleIds = vehicles.map((v) => v.id);

        let hasActiveSession = false;
        if (vehicleIds.length > 0) {
          const activeCheckIn = await tx.checkInRecord.findFirst({
            where: {
              vehicleId: { in: vehicleIds },
              checkOutTime: null,
              status: 'PARKING',
            },
          });
          if (activeCheckIn) hasActiveSession = true;
        }

        if (!hasActiveSession) {
          const activeDriverSession = await tx.checkInRecord.findFirst({
            where: {
              driverId: userId,
              checkOutTime: null,
              status: 'PARKING',
            },
          });
          if (activeDriverSession) hasActiveSession = true;
        }

        if (hasActiveSession) {
          reasons.push({
            type: 'ACTIVE_PARKING_SESSION',
            message: 'Tài khoản đang có xe trong bãi hoặc phiên gửi xe chưa kết thúc.',
          });
        }

        // 2. Check for unpaid or pending payments
        const pendingPayment = await tx.payment.findFirst({
          where: {
            status: 'PENDING',
            OR: [
              { checkInRecord: { driverId: userId } },
              { checkInRecord: { vehicle: { ownerId: userId, isArchived: false } } },
              { booking: { createdById: userId } },
              { monthlyPackage: { userId: userId } },
            ],
          },
        });
        if (pendingPayment) {
          reasons.push({
            type: 'UNPAID_PAYMENT',
            message: 'Tài khoản đang có khoản thanh toán chưa hoàn tất hoặc đang chờ xử lý.',
          });
        }

        // 3. Check for active bookings
        const activeBooking = await tx.booking.findFirst({
          where: {
            createdById: userId,
            status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
          },
        });
        if (activeBooking) {
          reasons.push({
            type: 'ACTIVE_BOOKING',
            message: 'Tài khoản đang có lượt đặt chỗ chưa hoàn tất hoặc chưa hủy.',
          });
        }

        // 4. Check for active monthly packages using status and expiryDate >= now
        const activePackage = await tx.monthlyPackage.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            expiryDate: {
              gte: new Date(),
            },
          },
        });
        if (activePackage) {
          reasons.push({
            type: 'ACTIVE_MONTHLY_PACKAGE',
            message: 'Tài khoản đang có gói tháng đang hoạt động.',
          });
        }

        if (reasons.length > 0) {
          const err = new AppError(
            409,
            'Không thể xóa tài khoản khi vẫn còn phiên gửi xe, đặt chỗ, gói tháng hoặc khoản thanh toán chưa hoàn tất.',
            true,
            'ACCOUNT_DELETION_BLOCKED'
          );
          err.reasons = reasons;
          throw err;
        }

        // Anonymize user details
        const anonymizedEmail = `deleted-${userId}-${randomBytes(3).toString('hex')}@invalid.local`;

        // Generate secure random unusable password hash
        const anonymousPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

        // Update User to inactive and anonymized state
        await tx.user.update({
          where: { id: userId },
          data: {
            fullName: 'Người dùng đã xóa',
            email: anonymizedEmail,
            phoneNumber: null,
            avatarUrl: null,
            passwordHash: anonymousPasswordHash,
            isActive: false,
          },
        });

        // Archive vehicles by clearing owner contact details while preserving owner relation for history
        if (vehicleIds.length > 0) {
          await tx.vehicle.updateMany({
            where: { ownerId: userId },
            data: {
              ownerFullName: 'Người dùng đã xóa',
              ownerEmail: null,
              ownerPhone: null,
              isArchived: true,
              isMonthly: false,
            },
          });
        }
      });

      // Clear in-memory OTP stores after the transaction has successfully committed
      otpStore.delete(originalEmail);
      resetOtpStore.delete(originalEmail);
    }
  };
}

const productionAuthService = createAuthService({
  prisma,
  sendOtpEmail,
});

export const authService = {
  sendOtp: (input: { email: string; fullName: string }) => productionAuthService.sendOtp(input),
  forgotPasswordSendOtp: (input: { email: string }) => productionAuthService.forgotPasswordSendOtp(input),
  resetPassword: (input: { email: string; otp: string; newPassword: string }) => productionAuthService.resetPassword(input),
  register: (input: RegisterInput) => productionAuthService.register(input),

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
    return productionAuthService.deleteAccount(userId, password);
  },
};