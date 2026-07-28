import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { sendEmail } from './email.service';
import { stripe } from '../config/stripe';
import { Prisma } from '@prisma/client';

const PKG_ACTIVE = 'ACTIVE';
const PKG_EXPIRED = 'EXPIRED';
const VEHICLE_CAR = 'CAR';
const VEHICLE_MOTORBIKE = 'MOTORBIKE';

export interface CreatePackageInput {
  userId: string;
  vehicleId: string;
  planId?: string;
  startDate: Date;
  expiryDate: Date;
  price: number;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
  vehicleType?: string;
}

export const PACKAGE_PRICES: Record<string, Record<string, number>> = {
  CAR: {
    '1y': 1200000,
    '3m': 900000,
    '1m': 600000,
  },
  MOTORBIKE: {
    '1y': 500000,
    '3m': 300000,
    '1m': 150000,
  },
};

export function getTierFromPlan(planId: string | null): 'VIP' | 'POPULAR' | 'REGULAR' {
  if (planId === '1y') return 'VIP';
  if (planId === '3m') return 'POPULAR';
  return 'REGULAR'; // default/1m
}

async function selectFloorForPackage(vehicleType: string, allowedTier: string | null, tx: any) {
  const tier = allowedTier ?? 'REGULAR';
  // Find all Floors for this vehicleType and customerType = 'MONTHLY'
  const floors = await tx.floor.findMany({
    where: {
      vehicleType,
      customerType: 'MONTHLY',
    },
    orderBy: { floorCode: 'asc' },
  });

  const now = new Date();

  for (const floor of floors) {
    // Count physical slots on this floor matching this tier and type
    const physicalCapacity = await tx.parkingSlot.count({
      where: {
        floorId: floor.id,
        type: vehicleType,
        tier,
      },
    });

    // Count active monthly packages on this floor and tier
    const usedCapacity = await tx.monthlyPackage.count({
      where: {
        floorId: floor.id,
        allowedTier: tier,
        status: 'ACTIVE',
        expiryDate: { gte: now },
      },
    });

    if (usedCapacity < physicalCapacity) {
      return floor; // Choose this floor
    }
  }

  return null; // No floor has available capacity
}

export const monthlyPackageService = {
  // Real Stripe Checkout Session Creation (Accepts only trusted vehicleId and planId)
  async createCheckoutSession(input: { userId: string; vehicleId: string; planId: string }) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.ownerId !== input.userId) {
      throw new AppError(403, 'Bạn không có quyền với xe này');
    }

    const now = new Date();
    const existingActive = await prisma.monthlyPackage.findFirst({
      where: {
        vehicleId: input.vehicleId,
        status: 'ACTIVE',
        expiryDate: { gt: now },
      },
    });
    if (existingActive) {
      throw new AppError(400, 'Phương tiện này đang có gói tháng còn hiệu lực.');
    }

    const allowedTier = getTierFromPlan(input.planId);

    // Derive price server-side from stable config
    const price = PACKAGE_PRICES[vehicle.type]?.[input.planId];
    if (!price) {
      throw new AppError(400, 'Mã gói đăng ký không hợp lệ.');
    }

    // Dry-run capacity verification
    const floor = await selectFloorForPackage(vehicle.type, allowedTier, prisma);
    if (!floor) {
      throw new AppError(400, 'Hiện khu vực của gói này đã hết chỗ.');
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
    if (stripeSecret === 'sk_test_mock') {
      return {
        sessionId: `cs_test_${Math.random().toString(36).substring(2, 15)}`,
        url: 'https://checkout.stripe.com/c/pay/cs_test_mock',
      };
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new AppError(500, 'FRONTEND_URL environment variable is not configured.');
    }

    if (!stripe) {
      throw new AppError(400, 'Chức năng thanh toán Stripe chưa được cấu hình trên server.');
    }

    const session = await stripe.checkout.sessions.create({
      success_url: `${frontendUrl}/driver/monthly-package?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/driver/monthly-package?cancelled=true`,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name: `Đăng ký gói tháng - ${input.planId} (${allowedTier})`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: input.userId,
        vehicleId: input.vehicleId,
        planId: input.planId,
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  },

  // Stripe Webhook Processing (activates package idempotently & concurrency-safe)
  async handleStripeWebhook(event: any) {
    if (event.type !== 'checkout.session.completed') {
      return { received: true };
    }
    const session = event.data?.object;
    if (!session) throw new AppError(400, 'Invalid Stripe webhook object format.');

    const transactionCode = session.id;
    const metadata = session.metadata;
    if (!metadata || !metadata.userId || !metadata.vehicleId || !metadata.planId) {
      throw new AppError(400, 'Missing required metadata identifiers.');
    }

    const userId = metadata.userId;
    const vehicleId = metadata.vehicleId;
    const planId = metadata.planId;

    let attempts = 0;
    const maxAttempts = 3;

    while (true) {
      attempts++;
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Idempotency Check
          const existingPayment = await tx.payment.findFirst({
            where: { transactionCode, status: 'SUCCESS' },
          });
          if (existingPayment) {
            return { success: true, alreadyProcessed: true };
          }

          // 2. Validate vehicle ownership & existence
          const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
          if (!vehicle) throw new AppError(404, 'Vehicle not found');
          if (vehicle.ownerId !== userId) {
            throw new AppError(403, 'Vehicle ownership mismatch');
          }

          // 3. Derive official plan details and verify actual payment amount and currency
          const allowedTier = getTierFromPlan(planId);
          const expectedPrice = PACKAGE_PRICES[vehicle.type]?.[planId];
          if (!expectedPrice) {
            throw new AppError(400, 'Invalid package plan configuration.');
          }

          if (session.payment_status !== 'paid') {
            throw new AppError(400, 'Session has not been paid.');
          }
          if (session.currency?.toLowerCase() !== 'vnd') {
            throw new AppError(400, `Invalid currency: expected VND, got ${session.currency}`);
          }
          if (session.amount_total !== expectedPrice) {
            throw new AppError(400, `Invalid payment amount: expected ${expectedPrice}, got ${session.amount_total}`);
          }

          // 4. Prevent duplicate active packages
          const now = new Date();
          const existingActive = await tx.monthlyPackage.findFirst({
            where: {
              vehicleId,
              status: 'ACTIVE',
              expiryDate: { gt: now },
            },
          });
          if (existingActive) {
            throw new AppError(400, 'Vehicle already has an active monthly package.');
          }

          // 5. Resolve Floor capacity
          const floor = await selectFloorForPackage(vehicle.type, allowedTier, tx);
          if (!floor) {
            throw new AppError(400, 'Khu vực đỗ xe hiện tại đã đủ số lượng đăng ký.');
          }

          const durationDays = planId === '1y' ? 365 : planId === '3m' ? 90 : 30;
          const startDate = new Date();
          const expiryDate = new Date();
          expiryDate.setDate(startDate.getDate() + durationDays);

          // Create ACTIVE package
          const pkg = await tx.monthlyPackage.create({
            data: {
              userId,
              vehicleId,
              floorId: floor.id,
              planName: planId,
              startDate,
              expiryDate,
              price: expectedPrice,
              status: 'ACTIVE',
              allowedTier,
            },
          });

          // Create Payment (Triggering db unique constraint if duplicate concurrent request inserts this transactionCode)
          await tx.payment.create({
            data: {
              monthlyPackageId: pkg.id,
              amount: expectedPrice,
              method: 'CARD',
              type: 'MONTHLY',
              status: 'SUCCESS',
              transactionCode,
              paidAt: new Date(),
            },
          });

          // Update vehicle isMonthly state
          await tx.vehicle.update({
            where: { id: vehicleId },
            data: { isMonthly: true },
          });

          // Send confirmation email
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (user?.email) {
            await sendEmail(
              user.email,
              'Xác nhận đăng ký gói tháng thành công',
              `Chào bạn,<br/><br/>Gói tháng cho xe <strong>${vehicle.plateNumber}</strong> đã được kích hoạt thành công.<br/>Khu vực đỗ: <strong>Tầng ${floor.name} (${allowedTier === 'VIP' ? 'Khu VIP' : allowedTier === 'POPULAR' ? 'Khu Phổ biến' : 'Khu Cơ bản'})</strong>.<br/>Hạn sử dụng: <strong>${expiryDate.toLocaleDateString('vi-VN')}</strong>.<br/><br/>Cảm ơn bạn đã tin dùng.`
            );
          }

          return { success: true };
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (err: any) {
        // P2034 is Prisma's code for transaction serialization conflict
        if (err.code === 'P2034' && attempts < maxAttempts) {
          console.warn(`[Webhook] Transaction serialization conflict (attempt ${attempts}). Retrying...`);
          await new Promise(res => setTimeout(res, attempts * 100));
          continue;
        }
        // P2002 is Prisma's code for unique constraint violation
        if (err.code === 'P2002' && err.meta?.target?.includes('transactionCode')) {
          return { success: true, alreadyProcessed: true };
        }
        throw err;
      }
    }
  },

  // CASH / EWALLET creation flow (immediate activation)
  async create(input: CreatePackageInput) {
    if (input.expiryDate <= input.startDate) {
      throw new AppError(400, 'Expiry date must be after start date');
    }
    if (input.expiryDate <= new Date()) {
      throw new AppError(400, 'Expiry date must be in the future');
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.ownerId !== input.userId) {
      throw new AppError(403, 'Bạn không có quyền với xe này');
    }

    if (input.vehicleType && vehicle.type !== input.vehicleType) {
      throw new AppError(400, 'Phương tiện không khớp với loại gói đăng ký');
    }

    const now = new Date();
    const existingActive = await prisma.monthlyPackage.findFirst({
      where: {
        vehicleId: input.vehicleId,
        status: 'ACTIVE',
        expiryDate: { gt: now },
      },
    });
    if (existingActive) {
      throw new AppError(400, 'Phương tiện này đang có gói tháng còn hiệu lực.');
    }

    const durationMs = input.expiryDate.getTime() - input.startDate.getTime();
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
    const resolvedTier = getTierFromPlan(input.planId ?? null);

    return prisma.$transaction(async (tx) => {
      const floor = await selectFloorForPackage(vehicle.type, resolvedTier, tx);
      if (!floor) {
        throw new AppError(400, 'Hiện khu vực của gói này đã hết chỗ. Vui lòng chọn gói khác.');
      }

      const pkg = await tx.monthlyPackage.create({
        data: {
          userId: input.userId,
          vehicleId: input.vehicleId,
          floorId: floor.id,
          planName: input.planId ?? '1m',
          startDate: input.startDate,
          expiryDate: input.expiryDate,
          price: input.price,
          status: 'ACTIVE',
          allowedTier: resolvedTier,
        },
      });

      await tx.payment.create({
        data: {
          monthlyPackageId: pkg.id,
          amount: input.price,
          method: input.paymentMethod,
          type: 'MONTHLY',
          status: 'SUCCESS',
        },
      });

      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { isMonthly: true },
      });

      return tx.monthlyPackage.findUnique({
        where: { id: pkg.id },
        include: { vehicle: true, floor: true, payments: true },
      });
    });
  },

  async expireStalePackages() {
    return prisma.monthlyPackage.updateMany({
      where: {
        status: PKG_ACTIVE,
        expiryDate: { lt: new Date() },
      },
      data: { status: PKG_EXPIRED },
    });
  },

  async getActivePackages() {
    return prisma.monthlyPackage.findMany({
      where: { status: PKG_ACTIVE },
      include: { user: true, vehicle: true, floor: true },
    });
  },

  async getByUser(userId: string) {
    return prisma.monthlyPackage.findMany({
      where: { userId },
      include: { vehicle: true, floor: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getByVehicle(vehicleId: string) {
    return prisma.monthlyPackage.findFirst({
      where: { vehicleId },
      include: { user: true, vehicle: true, floor: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async renewPackage(packageId: string, userId: string) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { user: true, vehicle: { select: { type: true, plateNumber: true } } },
    });
    if (!pkg) throw new AppError(404, 'Gói tháng không tồn tại');
    if (pkg.userId !== userId) throw new AppError(403, 'Không có quyền gia hạn gói này');

    const now = new Date();
    const durationMs = pkg.expiryDate.getTime() - pkg.startDate.getTime();
    if (durationMs <= 0) {
      throw new AppError(400, 'Không thể xác định thời hạn gói để gia hạn');
    }

    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
    const renewFrom = pkg.expiryDate > now ? pkg.expiryDate : now;
    const newExpiryDate = new Date(renewFrom);
    newExpiryDate.setDate(newExpiryDate.getDate() + durationDays);
    const newStartDate = pkg.expiryDate > now ? pkg.startDate : now;

    // Check capacity before renewal
    const floor = await selectFloorForPackage(pkg.vehicle.type, pkg.allowedTier, prisma);
    if (!floor) {
      throw new AppError(400, 'Không thể gia hạn: Khu vực hiện tại đã hết chỗ trống.');
    }

    const updated = await prisma.monthlyPackage.update({
      where: { id: packageId },
      data: {
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        status: PKG_ACTIVE,
        floorId: floor.id,
      },
      include: { user: true, vehicle: true, floor: true, payments: true },
    });

    if (updated.user?.email) {
      await sendEmail(
        updated.user.email,
        'Xác nhận gia hạn gói tháng',
        `Chào bạn,<br/><br/>Gói tháng cho xe <strong>${pkg.vehicle.plateNumber}</strong> đã được gia hạn thành công. Ngày hết hạn mới là <strong>${newExpiryDate.toLocaleDateString('vi-VN')}</strong>.<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.`
      );
    }

    return updated;
  },

  async setAutoRenew(packageId: string, userId: string, enabled: boolean) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { user: true },
    });
    if (!pkg) throw new AppError(404, 'Gói tháng không tồn tại');
    if (pkg.userId !== userId) throw new AppError(403, 'Không có quyền thay đổi cài đặt này');

    const updated = await prisma.monthlyPackage.update({
      where: { id: packageId },
      data: { autoRenew: enabled },
      include: { user: true, vehicle: true, floor: true, payments: true },
    });

    if (enabled && updated.user?.email) {
      await sendEmail(
        updated.user.email,
        'Gia hạn gói tháng được bật',
        `Chào bạn,<br/><br/>Bạn đã bật chế độ gia hạn tự động cho gói tháng. Chúng tôi sẽ thông báo khi gói được gia hạn.<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.`
      );
    }

    return updated;
  },

  async cancelPackage(packageId: string, userId: string) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { user: true, vehicle: true },
    });
    if (!pkg) throw new AppError(404, 'Gói tháng không tồn tại');
    if (pkg.userId !== userId) throw new AppError(403, 'Không có quyền hủy gói này');
    if (pkg.status !== PKG_ACTIVE) throw new AppError(400, 'Gói tháng không ở trạng thái hoạt động');

    return prisma.$transaction(async (tx) => {
      // 1. Update package status to CANCELLED and disable auto-renew
      const updated = await tx.monthlyPackage.update({
        where: { id: packageId },
        data: { status: 'CANCELLED', autoRenew: false },
        include: { user: true, vehicle: true, floor: true, payments: true },
      });

      // 2. Set vehicle isMonthly = false
      await tx.vehicle.update({
        where: { id: pkg.vehicleId },
        data: { isMonthly: false },
      });

      if (updated.user?.email) {
        await sendEmail(
          updated.user.email,
          'Xác nhận hủy gói tháng',
          `Chào bạn,<br/><br/>Gói tháng cho xe <strong>${pkg.vehicle?.plateNumber ?? pkg.vehicleId}</strong> đã được hủy thành công.<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.`
        );
      }

      return updated;
    });
  },

  async getZoneQuotas() {
    const tiers = ['VIP', 'POPULAR', 'REGULAR'];
    const result: any = { CAR: {}, MOTORBIKE: {} };

    for (const vtype of [VEHICLE_CAR, VEHICLE_MOTORBIKE]) {
      for (const tier of tiers) {
        // Find floors
        const floors = await prisma.floor.findMany({
          where: { vehicleType: vtype, customerType: 'MONTHLY' },
        });

        let totalCapacity = 0;
        let totalSold = 0;
        const now = new Date();

        for (const floor of floors) {
          const physical = await prisma.parkingSlot.count({
            where: { floorId: floor.id, type: vtype, tier },
          });
          const sold = await prisma.monthlyPackage.count({
            where: { floorId: floor.id, allowedTier: tier, status: 'ACTIVE', expiryDate: { gte: now } },
          });

          totalCapacity += physical;
          totalSold += sold;
        }

        result[vtype][tier] = {
          capacity: totalCapacity,
          sold: totalSold,
          remaining: Math.max(0, totalCapacity - totalSold),
        };
      }
    }

    // Preserve top-level properties for legacy compatibility
    result.VIP = result.CAR.VIP;
    result.POPULAR = result.CAR.POPULAR;
    result.REGULAR = result.CAR.REGULAR;

    return result;
  },
};
