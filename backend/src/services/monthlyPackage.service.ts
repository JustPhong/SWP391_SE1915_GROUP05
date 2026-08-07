import prisma from '../config/db';
import { AppError } from '../utils/helpers';
import { sendEmail } from './email.service';
import { stripe } from '../config/stripe';
import { Prisma } from '@prisma/client';
import { generateMonthlyAccessPin } from '../utils/pin';
import { normalizeLicensePlate } from '../utils/plate';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const PKG_ACTIVE = 'ACTIVE';
const PKG_EXPIRED = 'EXPIRED';
const VEHICLE_CAR = 'CAR';
const VEHICLE_MOTORBIKE = 'MOTORBIKE';

function mapEffectiveStatus(pkg: any) {
  if (!pkg) return pkg;
  const now = new Date();
  const isExpiredActive = pkg.status === PKG_ACTIVE && pkg.expiryDate <= now;
  const effectiveStatus = isExpiredActive ? PKG_EXPIRED : pkg.status;
  const isEffectivelyActive = pkg.status === PKG_ACTIVE && pkg.expiryDate > now;
  return {
    ...pkg,
    effectiveStatus,
    isEffectivelyActive,
  };
}

export type CheckoutResult =
  | { status: 'CHECKOUT'; packageId: string; paymentId: string; sessionId: string; url: string }
  | { status: 'ALREADY_PROCESSED'; packageId: string; paymentId: string };

export type RenewResult =
  | { status: 'CHECKOUT'; packageId: string; paymentId: string; sessionId: string; url: string }
  | { status: 'ALREADY_PROCESSED'; packageId: string; paymentId: string };

export type ReconcileSessionResult =
  | { type: 'SUCCESS'; packageId: string; paymentId: string; planId: string; plateNumber: string }
  | { type: 'ALREADY_PROCESSED'; packageId: string; paymentId: string; planId: string; plateNumber: string }
  | { type: 'PENDING' };

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
    '1y': 15000000,
    '3m': 4000000,
    '1m': 1500000,
  },
  MOTORBIKE: {
    '1y': 3000000,
    '3m': 800000,
    '1m': 300000,
  },
};

export function getTierFromPlan(planId: string | null): 'VIP' | 'POPULAR' | 'REGULAR' {
  if (planId === '1y') return 'VIP';
  if (planId === '3m') return 'POPULAR';
  return 'REGULAR'; // default/1m
}

async function selectFloorForPackage(vehicleType: string, allowedTier: string, tx: any) {
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
        tier: allowedTier,
      },
    });

    // Count active monthly packages on this floor and tier
    const usedCapacity = await tx.monthlyPackage.count({
      where: {
        floorId: floor.id,
        allowedTier,
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

async function sendNotificationEmailSafely(details?: { email?: string | null; subject: string; body: string }) {
  if (details && details.email) {
    try {
      await sendEmail(details.email, details.subject, details.body);
    } catch (err) {
      console.error('[Email] Failed to send monthly package confirmation email:', err);
    }
  }
}

export const monthlyPackageService = {
  // Shared verified reconciliation logic for monthly package payments
  async reconcilePaymentSuccess(
    tx: any,
    paymentId: string,
    transactionCode: string,
    planId: string,
    targetTier: string,
    packageId: string,
    userId: string,
    amountTotal: number,
    isRenewal: boolean
  ) {
    const pkg = await tx.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { vehicle: true },
    });
    if (!pkg) {
      throw new AppError(404, 'Monthly package not found.');
    }
    if (pkg.userId !== userId) {
      throw new AppError(403, 'Monthly package ownership mismatch.');
    }

    const expectedPrice = PACKAGE_PRICES[pkg.vehicle.type]?.[planId];
    if (!expectedPrice) {
      throw new AppError(400, 'Invalid package plan configuration.');
    }
    if (amountTotal !== expectedPrice) {
      throw new AppError(400, `Amount mismatch: expected ${expectedPrice}, got ${amountTotal}`);
    }

    const now = new Date();

    const existingPayment = await tx.payment.findUnique({
      where: { id: paymentId },
    });
    if (!existingPayment) {
      throw new AppError(404, 'Payment record not found.');
    }

    if (existingPayment.status !== 'SUCCESS') {
      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: 'PENDING',
        },
        data: {
          status: 'SUCCESS',
          transactionCode,
          paidAt: now,
        },
      });

      if (paymentUpdate.count !== 1) {
        throw new AppError(400, 'Thanh toán không hợp lệ hoặc đã được xử lý.');
      }
    }

    let newStartDate: Date;
    let newExpiryDate: Date;
    const durationDays = planId === '1y' ? 365 : planId === '3m' ? 90 : 30;

    const wasEffectivelyActive = pkg.status === 'ACTIVE' && pkg.expiryDate > now;
    if (isRenewal) {
      if (wasEffectivelyActive) {
        if (!pkg.allowedTier) {
          throw new AppError(400, 'Không tìm thấy phân hạng đỗ xe hiện tại.');
        }
        if (targetTier !== pkg.allowedTier) {
          throw new AppError(400, `Gói đang hoạt động chỉ có thể gia hạn cùng phân hạng (${pkg.allowedTier}).`);
        }
      }
      const renewFrom = pkg.expiryDate > now ? pkg.expiryDate : now;
      newExpiryDate = new Date(renewFrom);
      newExpiryDate.setDate(newExpiryDate.getDate() + durationDays);
      newStartDate = pkg.expiryDate > now ? pkg.startDate : now;
    } else {
      newStartDate = now;
      newExpiryDate = new Date(now);
      newExpiryDate.setDate(newExpiryDate.getDate() + durationDays);
    }

    let newPin: string | null = pkg.monthlyAccessPin;
    let newPinIssuedAt: Date | null = pkg.monthlyAccessPinIssuedAt;

    if (!isRenewal) {
      // NEW PACKAGE
      newPin = generateMonthlyAccessPin();
      newPinIssuedAt = now;
    } else {
      // RENEWAL
      if (wasEffectivelyActive) {
        if (!newPin) {
          newPin = generateMonthlyAccessPin();
          newPinIssuedAt = now;
        }
      } else {
        // EXPIRED OR INACTIVE REACTIVATION
        newPin = generateMonthlyAccessPin();
        newPinIssuedAt = now;
      }
    }

    const floor = await selectFloorForPackage(pkg.vehicle.type, targetTier, tx);
    const floorId = floor ? floor.id : pkg.floorId;

    // Update MonthlyPackage safely
    await tx.monthlyPackage.update({
      where: { id: packageId },
      data: {
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        status: 'ACTIVE',
        planName: planId,
        price: expectedPrice,
        allowedTier: targetTier,
        floorId,
        monthlyAccessPin: newPin,
        monthlyAccessPinIssuedAt: newPinIssuedAt,
      },
    });

    // Update vehicle isMonthly
    await tx.vehicle.update({
      where: { id: pkg.vehicleId },
      data: { isMonthly: true },
    });

    // Return email info to send after commit
    const user = await tx.user.findUnique({ where: { id: userId } });
    return {
      email: user?.email,
      subject: isRenewal ? 'Xác nhận gia hạn gói tháng thành công' : 'Xác nhận đăng ký gói tháng thành công',
      body: isRenewal
        ? `Chào bạn,<br/><br/>Gói tháng cho xe của bạn đã được gia hạn thành công.<br/>Ngày hết hạn mới là <strong>${newExpiryDate.toLocaleDateString('vi-VN')}</strong>.<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.`
        : `Chào bạn,<br/><br/>Gói tháng cho xe <strong>${pkg.vehicle.plateNumber}</strong> đã được kích hoạt thành công.<br/>Hạng vé: <strong>${targetTier}</strong>.<br/>Hạn sử dụng: <strong>${newExpiryDate.toLocaleDateString('vi-VN')}</strong>.<br/><br/>Cảm ơn bạn đã tin dùng.`
    };
  },

  // Dedicated Stripe return reconciliation — requires only sessionId from the browser
  // All trusted IDs (paymentId, packageId, userId, vehicleId, planId) are obtained from the database
  async reconcileStripeSession(sessionId: string, userId: string): Promise<ReconcileSessionResult> {
    // Step 1: Find Payment by transactionCode (trusted DB lookup, not browser-supplied)
    const payment = await prisma.payment.findFirst({
      where: { transactionCode: sessionId, type: 'MONTHLY' },
      include: {
        monthlyPackage: {
          include: { vehicle: true },
        },
      },
    });

    if (!payment) {
      // Session not found in our DB — may not have been processed yet
      return { type: 'PENDING' };
    }

    if (!payment.monthlyPackage) {
      throw new AppError(400, 'Giao dịch không liên kết với gói tháng hợp lệ.');
    }

    const pkg = payment.monthlyPackage;

    // Step 2: Verify this payment belongs to the authenticated user
    if (pkg.userId !== userId) {
      throw new AppError(403, 'Giao dịch này không thuộc về tài khoản của bạn.');
    }

    const plateNumber = pkg.vehicle?.plateNumber ?? pkg.vehicleId;
    const paymentId = payment.id;
    const packageId = pkg.id;

    // Step 3: Already fully processed — verify package is actually active before returning
    if (payment.status === 'SUCCESS') {
      const now = new Date();
      const isConsistent =
        pkg.status === 'ACTIVE' &&
        pkg.expiryDate > now &&
        pkg.vehicle?.isMonthly === true;

      if (isConsistent) {
        return {
          type: 'ALREADY_PROCESSED',
          packageId,
          paymentId,
          planId: pkg.planName ?? '',
          plateNumber,
        };
      }
      // Payment is SUCCESS but package is stale — fall through to repair via Stripe verification
    }

    // Step 4: Retrieve and verify the Stripe Checkout Session
    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err: any) {
      console.error('[reconcileStripeSession] Stripe retrieval failed:', err);
      throw new AppError(503, 'Không thể kiểm tra trạng thái thanh toán từ Stripe. Vui lòng thử lại sau.');
    }

    if (stripeSession.payment_status !== 'paid') {
      // Not paid yet — treat as pending
      return { type: 'PENDING' };
    }

    // Step 5: Validate Stripe session metadata against our trusted DB data
    const metadata = stripeSession.metadata;
    if (
      !metadata ||
      !metadata.paymentId ||
      !metadata.monthlyPackageId ||
      !metadata.userId ||
      !metadata.vehicleId ||
      !metadata.planId ||
      !metadata.type
    ) {
      throw new AppError(400, 'Stripe session metadata không đầy đủ.');
    }

    if (metadata.planId !== '1m' && metadata.planId !== '3m' && metadata.planId !== '1y') {
      throw new AppError(400, 'Mã gói trong Stripe session metadata không hợp lệ.');
    }

    if (metadata.type !== 'purchase' && metadata.type !== 'renew') {
      throw new AppError(400, 'Loại giao dịch trong Stripe session metadata không hợp lệ.');
    }

    // Cross-check Stripe metadata against trusted DB records
    if (
      metadata.paymentId !== paymentId ||
      metadata.monthlyPackageId !== packageId ||
      metadata.userId !== userId ||
      metadata.vehicleId !== pkg.vehicleId
    ) {
      throw new AppError(400, 'Stripe session metadata không khớp với thông tin giao dịch.');
    }

    if (stripeSession.currency?.toLowerCase() !== 'vnd') {
      throw new AppError(400, `Đơn vị tiền tệ không hợp lệ: expected VND, got ${stripeSession.currency}`);
    }

    const vehicleType = pkg.vehicle.type;
    const planId = metadata.planId;
    const resolvedPrice = PACKAGE_PRICES[vehicleType]?.[planId];
    if (!resolvedPrice) {
      throw new AppError(400, 'Không tìm thấy cấu hình giá phù hợp.');
    }

    if (stripeSession.amount_total === null || stripeSession.amount_total === undefined) {
      throw new AppError(400, 'Stripe session amount_total không hợp lệ.');
    }

    if (stripeSession.amount_total !== resolvedPrice) {
      throw new AppError(400, `Số tiền không khớp: expected ${resolvedPrice}, got ${stripeSession.amount_total}`);
    }

    const targetTier = getTierFromPlan(planId);
    const isRenewal = metadata.type === 'renew';

    // Step 6: Call the shared idempotent reconciliation function
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const emailDetails = await prisma.$transaction(async (tx) => {
          return await monthlyPackageService.reconcilePaymentSuccess(
            tx,
            paymentId,
            sessionId,
            planId,
            targetTier,
            packageId,
            userId,
            stripeSession.amount_total as number,
            isRenewal
          );
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        await sendNotificationEmailSafely(emailDetails);

        // Determine which result type to return
        const resultType = payment.status === 'SUCCESS' ? 'ALREADY_PROCESSED' : 'SUCCESS';
        return {
          type: resultType,
          packageId,
          paymentId,
          planId,
          plateNumber,
        };
      } catch (err: any) {
        if (err.code === 'P2034' && attempts < maxAttempts) {
          console.warn(`[reconcileStripeSession] Serialization conflict (attempt ${attempts}). Retrying...`);
          await new Promise(res => setTimeout(res, attempts * 100));
          continue;
        }
        if (err.code === 'P2002' && err.meta?.target?.includes('transactionCode')) {
          // Duplicate transactionCode — already processed concurrently
          return {
            type: 'ALREADY_PROCESSED',
            packageId,
            paymentId,
            planId,
            plateNumber,
          };
        }
        throw err;
      }
    }

    throw new AppError(503, 'Không thể hoàn tất xác nhận thanh toán sau nhiều lần thử.');
  },

  // Real Stripe Checkout Session Creation (Accepts only trusted vehicleId and planId)
  async createCheckoutSession(input: { userId: string; vehicleId: string; planId: string; sessionId?: string }): Promise<CheckoutResult> {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError(404, 'Vehicle not found');
    if (vehicle.ownerId !== input.userId) {
      throw new AppError(403, 'Bạn không có quyền với xe này');
    }

    const now = new Date();

    // Check if there is an existing package for this vehicle
    const existingPkg = await prisma.monthlyPackage.findUnique({
      where: { vehicleId: input.vehicleId },
      include: {
        payments: {
          where: {
            OR: [
              ...(input.sessionId ? [{ transactionCode: input.sessionId }] : []),
              { status: 'PENDING' }
            ]
          },
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    const allowedTier = getTierFromPlan(input.planId);
    const price = PACKAGE_PRICES[vehicle.type]?.[input.planId];
    if (!price) {
      throw new AppError(400, 'Mã gói đăng ký không hợp lệ.');
    }

    if (existingPkg) {
      const successPayment = existingPkg.payments.find(p => p.status === 'SUCCESS' || (input.sessionId && p.transactionCode === input.sessionId && p.status === 'SUCCESS'));
      if (successPayment) {
        const isPkgUpdated = existingPkg.status === 'ACTIVE' && existingPkg.expiryDate > now;
        if (!isPkgUpdated) {
          const targetTier = getTierFromPlan(input.planId);
          const emailDetails = await prisma.$transaction(async (tx) => {
            return await monthlyPackageService.reconcilePaymentSuccess(
              tx,
              successPayment.id,
              successPayment.transactionCode || input.sessionId || '',
              input.planId,
              targetTier,
              existingPkg.id,
              input.userId,
              Number(successPayment.amount),
              false
            );
          });
          await sendNotificationEmailSafely(emailDetails);
        }
        return {
          status: 'ALREADY_PROCESSED' as const,
          packageId: existingPkg.id,
          paymentId: successPayment.id,
        };
      }

      if (existingPkg.status === 'ACTIVE' && existingPkg.expiryDate > now) {
        throw new AppError(400, 'Phương tiện này đang có gói tháng còn hiệu lực.');
      }

      if (existingPkg.status !== 'PENDING_PAYMENT') {
        throw new AppError(400, 'Phương tiện này đã từng có gói tháng. Vui lòng sử dụng tính năng Gia hạn thay vì Đăng ký mới.');
      }

      if (existingPkg.status === 'PENDING_PAYMENT') {
        const pendingPayment = existingPkg.payments.find(p => p.status === 'PENDING');
        if (pendingPayment && pendingPayment.transactionCode) {
          try {
            const session = await stripe.checkout.sessions.retrieve(pendingPayment.transactionCode);
            if (session.payment_status === 'paid') {
              const metadata = session.metadata;
              if (
                !metadata ||
                !metadata.paymentId ||
                !metadata.monthlyPackageId ||
                !metadata.userId ||
                !metadata.vehicleId ||
                !metadata.planId ||
                !metadata.type
              ) {
                throw new AppError(400, 'Missing required metadata on paid Stripe session.');
              }

              if (metadata.planId !== '1m' && metadata.planId !== '3m' && metadata.planId !== '1y') {
                throw new AppError(400, 'Invalid planId in paid Stripe session metadata.');
              }

              if (
                metadata.paymentId !== pendingPayment.id ||
                metadata.monthlyPackageId !== existingPkg.id ||
                metadata.userId !== input.userId ||
                metadata.vehicleId !== input.vehicleId ||
                metadata.type !== 'purchase'
              ) {
                throw new AppError(400, 'Metadata mismatch on paid Stripe session.');
              }

              if (session.currency?.toLowerCase() !== 'vnd') {
                throw new AppError(400, 'Invalid currency on paid Stripe session.');
              }

              const resolvedPrice = PACKAGE_PRICES[vehicle.type]?.[metadata.planId];
              if (!resolvedPrice || session.amount_total !== resolvedPrice) {
                throw new AppError(400, 'Amount mismatch on paid Stripe session.');
              }

              // Fail closed: amount_total must not be null
              if (session.amount_total === null || session.amount_total === undefined) {
                throw new AppError(400, 'Cannot reconcile paid session: amount_total is null.');
              }
              // Reconcile immediately using validated metadata
              const targetTier = getTierFromPlan(metadata.planId);
              const emailDetails = await prisma.$transaction(async (tx) => {
                return await monthlyPackageService.reconcilePaymentSuccess(
                  tx,
                  metadata.paymentId,
                  session.id,
                  metadata.planId,
                  targetTier,
                  metadata.monthlyPackageId,
                  metadata.userId,
                  session.amount_total as number,
                  false
                );
              });
              await sendNotificationEmailSafely(emailDetails);
              return {
                status: 'ALREADY_PROCESSED' as const,
                packageId: metadata.monthlyPackageId,
                paymentId: metadata.paymentId,
              };
            } else if (session.status === 'open') {
              // Verify open session matches current inputs
              const isValidForReuse =
                session.id === pendingPayment.transactionCode &&
                session.metadata?.paymentId === pendingPayment.id &&
                session.metadata?.vehicleId === input.vehicleId &&
                session.metadata?.userId === input.userId &&
                session.metadata?.planId === input.planId &&
                session.metadata?.type === 'purchase' &&
                session.currency?.toLowerCase() === 'vnd' &&
                session.amount_total === price &&
                session.status === 'open';

              if (isValidForReuse) {
                return {
                  status: 'CHECKOUT' as const,
                  packageId: existingPkg.id,
                  paymentId: pendingPayment.id,
                  sessionId: session.id,
                  url: session.url!,
                };
              } else {
                // If any value differs, safely expire, retrieve and check before FAILED
                try {
                  await stripe.checkout.sessions.expire(pendingPayment.transactionCode);
                } catch (e) {
                  console.error('Error expiring mismatched purchase session:', e);
                  throw new AppError(503, 'Không thể hủy phiên thanh toán Stripe cũ. Vui lòng thử lại sau.');
                }

                let expiredSession;
                try {
                  expiredSession = await stripe.checkout.sessions.retrieve(pendingPayment.transactionCode);
                } catch (e) {
                  console.error('Error retrieving expired purchase session:', e);
                  throw new AppError(503, 'Không thể kiểm tra lại trạng thái Stripe sau khi hủy.');
                }

                if (expiredSession.status === 'expired' && expiredSession.payment_status !== 'paid') {
                  const updated = await prisma.payment.updateMany({
                    where: { id: pendingPayment.id, status: 'PENDING' },
                    data: { status: 'FAILED' },
                  });
                  if (updated.count !== 1) {
                    throw new AppError(409, 'Giao dịch đã thay đổi trạng thái.');
                  }
                } else {
                  throw new AppError(503, 'Không thể xác nhận trạng thái hết hạn từ Stripe.');
                }
              }
            } else if (session.status === 'expired') {
              // Already narrowed to expired: payment_status cannot be 'paid' here in a valid Stripe flow.
              // Transition PENDING -> FAILED.
              const updated = await prisma.payment.updateMany({
                where: { id: pendingPayment.id, status: 'PENDING' },
                data: { status: 'FAILED' },
              });
              if (updated.count !== 1) {
                throw new AppError(409, 'Giao dịch đã thay đổi trạng thái.');
              }
            } else {
              // Any other status: do not modify, return safe 503
              throw new AppError(503, 'Phiên thanh toán hiện tại chưa thể xác nhận trạng thái. Vui lòng thử lại sau.');
            }
          } catch (err: any) {
            if (err instanceof AppError) throw err;
            console.error('Stripe retrieval failed for purchase:', err);
            throw new AppError(503, 'Không thể kiểm tra trạng thái thanh toán từ Stripe lúc này. Vui lòng thử lại sau.');
          }
        } else if (pendingPayment) {
          // transactionCode is missing, preserve PENDING and return 503
          throw new AppError(503, 'Phiên thanh toán chưa được khởi tạo với Stripe. Vui lòng thử lại sau.');
        }
      }
    }

    // Reuse existing package in PENDING_PAYMENT status or create new one
    const startDate = new Date();
    const durationDays = input.planId === '1y' ? 365 : input.planId === '3m' ? 90 : 30;
    const expiryDate = new Date();
    expiryDate.setDate(startDate.getDate() + durationDays);

    let pkgId = existingPkg?.id;
    let newPayment;
    try {
      newPayment = await prisma.$transaction(async (tx) => {
        // Re-verify or select floor inside tx
        const floorTx = await selectFloorForPackage(vehicle.type, allowedTier, tx);
        if (!floorTx) {
          throw new AppError(400, 'Hiện khu vực của gói này đã hết chỗ.');
        }

        let p;
        if (existingPkg && existingPkg.status === 'PENDING_PAYMENT') {
          p = await tx.monthlyPackage.update({
            where: { id: existingPkg.id },
            data: {
              planName: input.planId,
              startDate,
              expiryDate,
              price,
              allowedTier,
              floorId: floorTx.id,
            },
          });
        } else {
          p = await tx.monthlyPackage.create({
            data: {
              userId: input.userId,
              vehicleId: input.vehicleId,
              floorId: floorTx.id,
              planName: input.planId,
              startDate,
              expiryDate,
              price,
              status: 'PENDING_PAYMENT',
              allowedTier,
            },
          });
        }
        pkgId = p.id;

        const pm = await tx.payment.create({
          data: {
            monthlyPackageId: p.id,
            amount: price,
            method: 'CARD',
            type: 'MONTHLY',
            status: 'PENDING',
          },
        });
        return pm;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new AppError(409, 'Phương tiện đã được đăng ký hoặc đang trong quá trình thanh toán gói tháng.');
      }
      throw err;
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
    if (stripeSecret === 'sk_test_mock') {
      const mockSessionId = `cs_test_${Math.random().toString(36).substring(2, 15)}`;
      await prisma.payment.update({
        where: { id: newPayment.id },
        data: { transactionCode: mockSessionId },
      });
      return {
        status: 'CHECKOUT' as const,
        sessionId: mockSessionId,
        url: 'https://checkout.stripe.com/c/pay/cs_test_mock',
        packageId: pkgId!,
        paymentId: newPayment.id,
      };
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new AppError(500, 'FRONTEND_URL environment variable is not configured.');
    }

    const session = await stripe.checkout.sessions.create({
      success_url: `${frontendUrl}/monthly-package?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/monthly-package?payment=cancelled`,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name: `Đăng ký gói tháng - ${input.planId === '1y' ? '1 năm' : input.planId === '3m' ? '3 tháng' : '1 tháng'} (${allowedTier})`,
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
        paymentId: newPayment.id,
        monthlyPackageId: pkgId!,
        type: 'purchase',
      },
    }, {
      idempotencyKey: `monthly_purchase_${newPayment.id}`,
    });

    await prisma.payment.update({
      where: { id: newPayment.id },
      data: { transactionCode: session.id },
    });

    return {
      status: 'CHECKOUT' as const,
      packageId: pkgId!,
      paymentId: newPayment.id,
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

    // Require checks:
    if (session.payment_status !== 'paid') {
      throw new AppError(400, 'Session has not been paid.');
    }
    if (session.currency?.toLowerCase() !== 'vnd') {
      throw new AppError(400, `Invalid currency: expected VND, got ${session.currency}`);
    }

    const metadata = session.metadata;
    if (
      !metadata ||
      !metadata.paymentId ||
      !metadata.monthlyPackageId ||
      !metadata.userId ||
      !metadata.vehicleId ||
      !metadata.planId ||
      !metadata.type
    ) {
      throw new AppError(400, 'Missing required metadata identifiers.');
    }

    const paymentId = metadata.paymentId;
    const packageId = metadata.monthlyPackageId;
    const userId = metadata.userId;
    const vehicleId = metadata.vehicleId;
    const planId = metadata.planId;
    const type = metadata.type; // 'renew' or 'purchase'

    if (planId !== '1m' && planId !== '3m' && planId !== '1y') {
      throw new AppError(400, 'Mã gói đăng ký trong metadata không hợp lệ.');
    }

    if (type !== 'purchase' && type !== 'renew') {
      throw new AppError(400, 'Loại giao dịch trong metadata không hợp lệ.');
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Check if payment already processed (idempotency check)
          const p = await tx.payment.findUnique({
            where: { id: paymentId },
            include: {
              monthlyPackage: {
                include: { vehicle: true }
              }
            }
          });

          if (!p) {
            throw new AppError(404, 'Payment record not found.');
          }

          if (p.status === 'SUCCESS') {
            return { success: true, alreadyProcessed: true };
          }

          // Cross-checks:
          if (p.id !== paymentId) {
            throw new AppError(400, 'Payment ID mismatch.');
          }

          if (!p.monthlyPackage) {
            throw new AppError(400, 'Payment is not linked to a monthly package.');
          }
          const pkg = p.monthlyPackage;

          if (p.monthlyPackageId !== packageId) {
            throw new AppError(400, 'Package ID mismatch.');
          }
          if (pkg.userId !== userId) {
            throw new AppError(400, 'User ID mismatch.');
          }
          if (pkg.vehicleId !== vehicleId) {
            throw new AppError(400, 'Vehicle ID mismatch.');
          }
          if (p.type !== 'MONTHLY') {
            throw new AppError(400, 'Payment type mismatch.');
          }
          if (session.id !== p.transactionCode) {
            throw new AppError(400, 'Stripe session ID mismatch with saved transactionCode.');
          }

          const vehicleType = pkg.vehicle.type;
          const targetTier = getTierFromPlan(planId);
          const resolvedPrice = PACKAGE_PRICES[vehicleType]?.[planId];
          if (!resolvedPrice) {
            throw new AppError(400, 'Không tìm thấy cấu hình giá phù hợp.');
          }

          if (session.amount_total !== resolvedPrice) {
            throw new AppError(400, `Amount mismatch: expected ${resolvedPrice}, got ${session.amount_total}`);
          }

          const emailDetails = await monthlyPackageService.reconcilePaymentSuccess(
            tx,
            paymentId,
            session.id,
            planId,
            targetTier,
            packageId,
            userId,
            session.amount_total,
            type === 'renew'
          );

          return { success: true, emailDetails };
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });

        if (result && result.emailDetails && !result.alreadyProcessed) {
          await sendNotificationEmailSafely(result.emailDetails);
        }

        return result;
      } catch (err: any) {
        if (err.code === 'P2034' && attempts < maxAttempts) {
          console.warn(`[Webhook] Transaction serialization conflict (attempt ${attempts}). Retrying...`);
          await new Promise(res => setTimeout(res, attempts * 100));
          continue;
        }
        if (err.code === 'P2002' && err.meta?.target?.includes('transactionCode')) {
          return { success: true, alreadyProcessed: true };
        }
        throw err;
      }
    }
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
    const packages = await prisma.monthlyPackage.findMany({
      where: {
        status: PKG_ACTIVE,
        expiryDate: { gt: new Date() },
      },
      include: { user: true, vehicle: true, floor: true },
    });
    return packages.map((pkg) => mapEffectiveStatus(pkg));
  },

  getPlans() {
    return [
      {
        id: '1m',
        name: 'Gói 1 tháng',
        durationDays: 30,
        allowedTier: 'REGULAR' as const,
        prices: {
          CAR: {
            price: PACKAGE_PRICES.CAR['1m'],
          },
          MOTORBIKE: {
            price: PACKAGE_PRICES.MOTORBIKE['1m'],
          },
        },
      },
      {
        id: '3m',
        name: 'Gói 3 tháng',
        durationDays: 90,
        allowedTier: 'POPULAR' as const,
        prices: {
          CAR: {
            price: PACKAGE_PRICES.CAR['3m'],
          },
          MOTORBIKE: {
            price: PACKAGE_PRICES.MOTORBIKE['3m'],
          },
        },
      },
      {
        id: '1y',
        name: 'Gói 1 năm',
        durationDays: 365,
        allowedTier: 'VIP' as const,
        prices: {
          CAR: {
            price: PACKAGE_PRICES.CAR['1y'],
          },
          MOTORBIKE: {
            price: PACKAGE_PRICES.MOTORBIKE['1y'],
          },
        },
      },
    ];
  },

  async getByUser(userId: string) {
    const packages = await prisma.monthlyPackage.findMany({
      where: { userId },
      include: { vehicle: true, floor: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    return packages.map((pkg) => mapEffectiveStatus(pkg));
  },

  async getByVehicle(vehicleId: string) {
    const pkg = await prisma.monthlyPackage.findFirst({
      where: { vehicleId },
      include: { user: true, vehicle: true, floor: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    return mapEffectiveStatus(pkg);
  },

  async renewPackage(packageId: string, userId: string, selectedPlanId?: string, searchSessionId?: string): Promise<RenewResult> {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { user: true, vehicle: { select: { id: true, type: true, plateNumber: true } } },
    });
    if (!pkg) throw new AppError(404, 'Gói tháng không tồn tại');
    if (pkg.userId !== userId) throw new AppError(403, 'Không có quyền gia hạn gói này');

    const planId = selectedPlanId || pkg.planName;
    if (!planId) {
      throw new AppError(400, 'Gói tháng hiện tại không có loại gói hợp lệ để gia hạn.');
    }

    if (planId !== '1m' && planId !== '3m' && planId !== '1y') {
      throw new AppError(400, 'Mã gói đăng ký không hợp lệ.');
    }

    const price = PACKAGE_PRICES[pkg.vehicle.type]?.[planId];
    if (price == null) {
      throw new AppError(400, 'Không tìm thấy mức giá gia hạn phù hợp cho gói này.');
    }

    const now = new Date();
    const isPackageActive = pkg.status === 'ACTIVE' && pkg.expiryDate > now;
    const targetTier = getTierFromPlan(planId);

    // Active package tier guard
    if (isPackageActive) {
      if (!pkg.allowedTier) {
        throw new AppError(400, 'Không tìm thấy phân hạng đỗ xe hiện tại.');
      }
      if (targetTier !== pkg.allowedTier) {
        throw new AppError(400, `Gói đang hoạt động chỉ có thể gia hạn cùng phân hạng (${pkg.allowedTier}). Để đổi phân hạng, vui lòng đợi gói hết hạn.`);
      }
    }

    // Dry-run capacity verification using target tier
    const floor = await selectFloorForPackage(pkg.vehicle.type, targetTier, prisma);
    if (!floor) {
      throw new AppError(400, 'Không thể gia hạn: Khu vực hiện tại đã hết chỗ trống.');
    }

    // Reuse or create a PENDING payment for this renewal session
    const existingPending = await prisma.payment.findFirst({
      where: {
        OR: [
          ...(searchSessionId ? [{ transactionCode: searchSessionId }] : []),
          {
            monthlyPackageId: packageId,
            status: 'PENDING',
            type: 'MONTHLY',
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending && existingPending.status === 'SUCCESS') {
      const isPkgUpdated = pkg.status === 'ACTIVE' && pkg.expiryDate > now;
      if (isPkgUpdated) {
        return {
          status: 'ALREADY_PROCESSED' as const,
          packageId: pkg.id,
          paymentId: existingPending.id,
        };
      } else {
        const targetTierForPaid = getTierFromPlan(planId);
        const emailDetails = await prisma.$transaction(async (tx) => {
          return await monthlyPackageService.reconcilePaymentSuccess(
            tx,
            existingPending.id,
            existingPending.transactionCode || searchSessionId || '',
            planId,
            targetTierForPaid,
            pkg.id,
            userId,
            Number(existingPending.amount),
            true
          );
        });
        await sendNotificationEmailSafely(emailDetails);
        return {
          status: 'ALREADY_PROCESSED' as const,
          packageId: pkg.id,
          paymentId: existingPending.id,
        };
      }
    }

    let payment = existingPending;
    let sessionId: string | undefined;
    let sessionUrl: string | undefined;

    if (existingPending) {
      let canReuse = false;
      if (existingPending.transactionCode) {
        try {
          const session = await stripe.checkout.sessions.retrieve(existingPending.transactionCode);
          if (session.payment_status === 'paid') {
            const metadata = session.metadata;
            if (
              !metadata ||
              !metadata.paymentId ||
              !metadata.monthlyPackageId ||
              !metadata.userId ||
              !metadata.vehicleId ||
              !metadata.planId ||
              !metadata.type
            ) {
              throw new AppError(400, 'Missing required metadata on paid Stripe session.');
            }

            if (metadata.planId !== '1m' && metadata.planId !== '3m' && metadata.planId !== '1y') {
              throw new AppError(400, 'Invalid planId in paid Stripe session metadata.');
            }

            if (
              metadata.paymentId !== existingPending.id ||
              metadata.monthlyPackageId !== packageId ||
              metadata.userId !== userId ||
              metadata.vehicleId !== pkg.vehicle.id ||
              metadata.type !== 'renew'
            ) {
              throw new AppError(400, 'Metadata mismatch on paid Stripe session.');
            }

            if (session.currency?.toLowerCase() !== 'vnd') {
              throw new AppError(400, 'Invalid currency on paid Stripe session.');
            }

            const resolvedPrice = PACKAGE_PRICES[pkg.vehicle.type]?.[metadata.planId];
            if (!resolvedPrice || session.amount_total !== resolvedPrice) {
              throw new AppError(400, 'Amount mismatch on paid Stripe session.');
            }

            // Fail closed: amount_total must not be null
            if (session.amount_total === null || session.amount_total === undefined) {
              throw new AppError(400, 'Cannot reconcile paid session: amount_total is null.');
            }
            const targetTierForPaid = getTierFromPlan(metadata.planId);
            const emailDetails = await prisma.$transaction(async (tx) => {
              return await monthlyPackageService.reconcilePaymentSuccess(
                tx,
                metadata.paymentId,
                session.id,
                metadata.planId,
                targetTierForPaid,
                metadata.monthlyPackageId,
                metadata.userId,
                session.amount_total as number,
                true
              );
            });
            await sendNotificationEmailSafely(emailDetails);
            return {
              status: 'ALREADY_PROCESSED' as const,
              packageId: metadata.monthlyPackageId,
              paymentId: metadata.paymentId,
            };
          } else if (session.status === 'open') {
            // Verify open session matches current inputs
            const isValidForReuse =
              session.id === existingPending.transactionCode &&
              session.metadata?.paymentId === existingPending.id &&
              session.metadata?.monthlyPackageId === packageId &&
              session.metadata?.vehicleId === pkg.vehicle.id &&
              session.metadata?.userId === userId &&
              session.metadata?.planId === planId &&
              session.metadata?.type === 'renew' &&
              session.currency?.toLowerCase() === 'vnd' &&
              session.amount_total === price &&
              session.status === 'open';

            if (isValidForReuse) {
              canReuse = true;
              sessionId = session.id;
              sessionUrl = session.url ?? undefined;
            } else {
              // If mismatched: safely expire, retrieve and check before FAILED
              try {
                await stripe.checkout.sessions.expire(existingPending.transactionCode);
              } catch (e) {
                console.error('Error expiring mismatched session in renewPackage:', e);
                throw new AppError(503, 'Không thể hủy phiên thanh toán Stripe cũ. Vui lòng thử lại sau.');
              }

              let expiredSession;
              try {
                expiredSession = await stripe.checkout.sessions.retrieve(existingPending.transactionCode);
              } catch (e) {
                console.error('Error retrieving expired session in renewPackage:', e);
                throw new AppError(503, 'Không thể kiểm tra lại trạng thái Stripe sau khi hủy.');
              }

              if (expiredSession.status === 'expired' && expiredSession.payment_status !== 'paid') {
                const updated = await prisma.payment.updateMany({
                  where: { id: existingPending.id, status: 'PENDING' },
                  data: { status: 'FAILED' },
                });
                if (updated.count !== 1) {
                  throw new AppError(409, 'Giao dịch đã thay đổi trạng thái.');
                }
                payment = null;
              } else {
                throw new AppError(503, 'Không thể xác nhận trạng thái hết hạn từ Stripe.');
              }
            }
          } else if (session.status === 'expired') {
            // Already narrowed to expired: payment_status cannot be 'paid' here in a valid Stripe flow.
            // Transition PENDING -> FAILED.
            const updated = await prisma.payment.updateMany({
              where: { id: existingPending.id, status: 'PENDING' },
              data: { status: 'FAILED' },
            });
            if (updated.count !== 1) {
              throw new AppError(409, 'Giao dịch đã thay đổi trạng thái.');
            }
            payment = null;
          } else {
            throw new AppError(503, 'Phiên thanh toán hiện tại chưa thể xác nhận trạng thái. Vui lòng thử lại sau.');
          }
        } catch (err: any) {
          if (err instanceof AppError) throw err;
          // Stripe retrieval failed (API/network error/timeout).
          // Preserve PENDING and return safe HTTP 503.
          console.error('Stripe retrieval failed/timeout in renewPackage:', err);
          throw new AppError(503, 'Không thể kiểm tra trạng thái thanh toán từ Stripe lúc này. Vui lòng thử lại sau.');
        }
      } else {
        // transactionCode is missing, preserve PENDING and return 503
        throw new AppError(503, 'Phiên thanh toán chưa được khởi tạo với Stripe. Vui lòng thử lại sau.');
      }
    }

    if (!payment || !sessionId || !sessionUrl) {
      const newPayment = await prisma.payment.create({
        data: {
          monthlyPackageId: packageId,
          amount: price,
          method: 'CARD',
          type: 'MONTHLY',
          status: 'PENDING',
        },
      });
      payment = newPayment;

      const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
      if (stripeSecret === 'sk_test_mock') {
        sessionId = `cs_test_${Math.random().toString(36).substring(2, 15)}`;
        sessionUrl = 'https://checkout.stripe.com/c/pay/cs_test_mock';
      } else {
        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) {
          throw new AppError(500, 'FRONTEND_URL environment variable is not configured.');
        }

        const session = await stripe.checkout.sessions.create({
          success_url: `${frontendUrl}/monthly-package?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendUrl}/monthly-package?payment=cancelled`,
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'vnd',
                product_data: {
                  name: `Gia hạn gói tháng - ${planId === '1y' ? '1 năm' : planId === '3m' ? '3 tháng' : '1 tháng'} (${targetTier})`,
                },
                unit_amount: price,
              },
              quantity: 1,
            },
          ],
          metadata: {
            userId: userId,
            vehicleId: pkg.vehicle.id,
            planId: planId,
            paymentId: newPayment.id,
            monthlyPackageId: pkg.id,
            type: 'renew',
          },
        }, {
          idempotencyKey: `monthly_renew_${newPayment.id}`,
        });

        sessionId = session.id;
        sessionUrl = session.url || undefined;
      }

      await prisma.payment.update({
        where: { id: newPayment.id },
        data: { transactionCode: sessionId },
      });
    }

    if (!payment) {
      throw new AppError(500, 'Không thể khởi tạo giao dịch thanh toán.');
    }
    const resolvedPayment = payment;

    return {
      status: 'CHECKOUT' as const,
      packageId,
      paymentId: resolvedPayment.id,
      sessionId: sessionId!,
      url: sessionUrl!,
    };
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

      return mapEffectiveStatus(updated);
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

  async getFloorQuotas(floorId: number): Promise<{
    floorId: number;
    quotas: { tier: 'VIP' | 'POPULAR' | 'REGULAR'; limit: number; sold: number; remaining: number }[];
  }> {
    const tiers: Array<'VIP' | 'POPULAR' | 'REGULAR'> = ['VIP', 'POPULAR', 'REGULAR'];
    const now = new Date();

    const quotas = await Promise.all(
      tiers.map(async (tier) => {
        const [limit, sold] = await Promise.all([
          prisma.parkingSlot.count({
            where: { floorId, tier },
          }),
          prisma.monthlyPackage.count({
            where: {
              floorId,
              allowedTier: tier,
              status: 'ACTIVE',
              expiryDate: { gte: now },
            },
          }),
        ]);
        const remaining = Math.max(0, limit - sold);
        return { tier, limit, sold, remaining };
      })
    );

    return { floorId, quotas };
  },



  async abandonPayment(input: { packageId: string; userId: string; paymentId: string; sessionId: string }) {
    const { packageId, userId, paymentId, sessionId } = input;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        monthlyPackage: {
          include: { vehicle: true }
        }
      },
    });

    if (!payment) {
      throw new AppError(404, 'Giao dịch không tồn tại.');
    }

    if (
      payment.monthlyPackageId !== packageId ||
      payment.type !== 'MONTHLY' ||
      payment.transactionCode !== sessionId ||
      !payment.monthlyPackage ||
      payment.monthlyPackage.userId !== userId
    ) {
      throw new AppError(400, 'Thông tin giao dịch không hợp lệ hoặc không thuộc về bạn.');
    }

    if (payment.status === 'SUCCESS') {
      return { success: true, alreadyProcessed: true };
    }

    if (payment.status === 'FAILED') {
      return { success: true, alreadyResolved: true };
    }

    if (!payment.transactionCode) {
      throw new AppError(503, 'Phiên thanh toán chưa được khởi tạo với Stripe. Vui lòng thử lại sau.');
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(payment.transactionCode);

      if (
        session.id !== sessionId ||
        session.metadata?.paymentId !== paymentId ||
        session.metadata?.monthlyPackageId !== packageId ||
        session.metadata?.userId !== userId ||
        session.metadata?.vehicleId !== payment.monthlyPackage.vehicleId
      ) {
        throw new AppError(400, 'Thông tin phiên thanh toán Stripe không khớp.');
      }

      if (session.payment_status === 'paid') {
        const metadata = session.metadata || {};
        const metaPlanId = metadata.planId;
        const metaType = metadata.type;
        const metaUserId = metadata.userId;
        const metaVehicleId = metadata.vehicleId;
        const metaPaymentId = metadata.paymentId;
        const metaPackageId = metadata.monthlyPackageId;

        if (
          metaPlanId !== '1m' &&
          metaPlanId !== '3m' &&
          metaPlanId !== '1y'
        ) {
          throw new AppError(400, 'Mã gói đăng ký trong metadata không hợp lệ.');
        }

        if (
          metaType !== 'purchase' &&
          metaType !== 'renew'
        ) {
          throw new AppError(400, 'Loại giao dịch trong metadata không hợp lệ.');
        }

        if (
          metaUserId !== userId ||
          metaVehicleId !== payment.monthlyPackage.vehicleId ||
          metaPaymentId !== paymentId ||
          metaPackageId !== packageId
        ) {
          throw new AppError(400, 'Metadata của Stripe session không khớp với thông tin yêu cầu.');
        }

        const vehicleType = payment.monthlyPackage.vehicle.type;
        const targetTier = getTierFromPlan(metaPlanId);
        const resolvedPrice = PACKAGE_PRICES[vehicleType]?.[metaPlanId];
        if (!resolvedPrice) {
          throw new AppError(400, 'Không tìm thấy mức giá phù hợp cho gói này.');
        }

        const emailDetails = await prisma.$transaction(async (tx) => {
          return await monthlyPackageService.reconcilePaymentSuccess(
            tx,
            paymentId,
            session.id,
            metaPlanId,
            targetTier,
            packageId,
            userId,
            session.amount_total ?? resolvedPrice,
            metaType === 'renew'
          );
        });
        await sendNotificationEmailSafely(emailDetails);
        return { success: true, alreadyProcessed: true };
      }

      if (session.status === 'open') {
        try {
          await stripe.checkout.sessions.expire(payment.transactionCode);
        } catch (e) {
          console.error('Error expiring Stripe session in abandonPayment:', e);
          throw new AppError(503, 'Không thể hủy phiên thanh toán Stripe lúc này. Vui lòng thử lại sau.');
        }

        let expiredSession;
        try {
          expiredSession = await stripe.checkout.sessions.retrieve(payment.transactionCode);
        } catch (e) {
          console.error('Error retrieving Stripe session after expire:', e);
          throw new AppError(503, 'Không thể kiểm tra lại trạng thái Stripe sau khi hủy.');
        }

        if (expiredSession.status === 'expired' && expiredSession.payment_status !== 'paid') {
          const updated = await prisma.payment.updateMany({
            where: {
              id: paymentId,
              status: 'PENDING',
            },
            data: { status: 'FAILED' },
          });
          if (updated.count !== 1) {
            throw new AppError(409, 'Giao dịch đã thay đổi trạng thái.');
          }
        } else {
          throw new AppError(503, 'Không thể xác nhận trạng thái hết hạn từ Stripe.');
        }
      } else if (session.status === 'expired') {
        const updated = await prisma.payment.updateMany({
          where: {
            id: paymentId,
            status: 'PENDING',
          },
          data: { status: 'FAILED' },
        });
        if (updated.count !== 1) {
          throw new AppError(409, 'Giao dịch đã thay đổi trạng thái.');
        }
      } else {
        throw new AppError(503, 'Trạng thái thanh toán của Stripe hiện chưa thể xác nhận.');
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error('Stripe retrieval/expire failed in abandonPayment:', err);
      throw new AppError(503, 'Lỗi kết nối đến Stripe. Vui lòng thử lại sau.');
    }

    return { success: true };
  },

  async ensureAccessPin(packageId: string, userId: string) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
    });
    if (!pkg) {
      throw new AppError(404, 'Không tìm thấy gói tháng.');
    }
    if (pkg.userId !== userId) {
      throw new AppError(403, 'Bạn không có quyền với gói tháng này.');
    }
    if (pkg.status !== 'ACTIVE') {
      throw new AppError(400, 'Gói tháng không ở trạng thái hoạt động.');
    }
    const now = new Date();
    if (pkg.expiryDate.getTime() <= now.getTime()) {
      throw new AppError(400, 'Gói tháng đã hết hạn.');
    }

    if (pkg.monthlyAccessPin) {
      return {
        monthlyAccessPin: pkg.monthlyAccessPin,
        monthlyAccessPinIssuedAt: pkg.monthlyAccessPinIssuedAt,
      };
    }

    const generatedPin = generateMonthlyAccessPin();
    const updated = await prisma.monthlyPackage.update({
      where: { id: packageId },
      data: {
        monthlyAccessPin: generatedPin,
        monthlyAccessPinIssuedAt: now,
      },
      select: {
        monthlyAccessPin: true,
        monthlyAccessPinIssuedAt: true,
      },
    });

    return updated;
  },

  async verifyMonthlyPackageAccessByPin(plateNumber: string, pin: string, txClient?: any) {
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new AppError(400, 'Mã PIN hoặc thông tin vé tháng không hợp lệ.');
    }

    const targetNormalized = normalizeLicensePlate(plateNumber);

    const client = txClient || prisma;
    const vehicles = await client.vehicle.findMany({
      include: {
        monthlyPackage: {
          include: {
            floor: true
          }
        }
      }
    });

    const vehicle = vehicles.find(
      (v: { plateNumber: string }) => normalizeLicensePlate(v.plateNumber) === targetNormalized
    );

    if (!vehicle || !vehicle.isMonthly || !vehicle.monthlyPackage) {
      throw new AppError(400, 'Mã PIN hoặc thông tin vé tháng không hợp lệ.');
    }

    const pkg = vehicle.monthlyPackage;
    const now = new Date();

    if (pkg.monthlyAccessPin !== pin) {
      throw new AppError(400, 'Mã PIN hoặc thông tin vé tháng không hợp lệ.');
    }

    if (pkg.status !== 'ACTIVE' || pkg.expiryDate.getTime() <= now.getTime()) {
      throw new AppError(400, 'Mã PIN hoặc thông tin vé tháng không hợp lệ.');
    }

    if (!pkg.floorId || !pkg.floor) {
      throw new AppError(400, 'Mã PIN hoặc thông tin vé tháng không hợp lệ.');
    }

    return { vehicle, monthlyPackage: pkg };
  },

  async getQrToken(packageId: string, vehicleId: string, userId: string) {
    const pkg = await prisma.monthlyPackage.findUnique({
      where: { id: packageId },
      include: { vehicle: true },
    });
    if (!pkg) {
      throw new AppError(404, 'Không tìm thấy gói tháng.');
    }
    if (pkg.userId !== userId) {
      throw new AppError(403, 'Bạn không có quyền với gói tháng này.');
    }
    if (pkg.status !== 'ACTIVE') {
      throw new AppError(400, 'Gói tháng không ở trạng thái hoạt động.');
    }
    const now = new Date();
    if (pkg.expiryDate.getTime() <= now.getTime()) {
      throw new AppError(400, 'Gói tháng đã hết hạn.');
    }
    if (pkg.vehicleId !== vehicleId || !pkg.vehicle || pkg.vehicle.ownerId !== userId) {
      throw new AppError(400, 'Thông tin xe không hợp lệ cho gói tháng này.');
    }

    const timeToExpiry = Math.floor((pkg.expiryDate.getTime() - now.getTime()) / 1000);
    if (timeToExpiry <= 0) {
      throw new AppError(400, 'Gói tháng đã hết hạn.');
    }

    const qrToken = jwt.sign(
      {
        purpose: 'MONTHLY_CHECKOUT_QR',
        packageId: pkg.id,
        vehicleId: pkg.vehicleId,
      },
      config.jwtSecret,
      {
        expiresIn: timeToExpiry,
        issuer: 'smart-parking-backend',
        audience: 'smart-parking-checkout',
        algorithm: 'HS256',
      }
    );

    return { qrToken };
  },
};
